import { Router } from 'express';
import Joi from 'joi';
import { executePlaygroundWalletPTB } from '../services/ptbExecuteService';
import { logger } from '../utils/logger';

const router = Router();

// View function schema - for read-only functions
const viewFunctionSchema = Joi.object({
  functionTarget: Joi.string().required(), // e.g., "0x123::counter::get_value"
  functionArgs: Joi.array().items(
    Joi.alternatives().try(
      Joi.string(), // Legacy support
      Joi.object({
        value: Joi.string().required(),
        type: Joi.string().required()
      })
    )
  ).default([]),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  sender: Joi.string().optional(), // Optional sender address for owned objects
});

// Execute PTB with playground wallet
const executePTBSchema = Joi.object({
  projectId: Joi.string().required(),
  functionTarget: Joi.string().required(), // e.g., "0x123::counter::create_counter"
  functionArgs: Joi.array().items(
    Joi.alternatives().try(
      Joi.string(), // Legacy support for existing calls
      Joi.object({
        value: Joi.string().required(),
        type: Joi.string().required()
      })
    )
  ).default([]),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
});

// Execute PTB with commands array (from PTB Builder)
const executePTBCommandsSchema = Joi.object({
  commands: Joi.array().items(Joi.object()).required(),
  network: Joi.string().valid('testnet', 'mainnet').default('testnet'),
});

// View function endpoint - for read-only functions
router.post('/view', async (req, res, _next) => {
  try {
    const { error, value } = viewFunctionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { functionTarget, functionArgs, network, sender } = value;

    logger.info(`Executing view function: ${functionTarget}`);
    logger.info(`Arguments: ${JSON.stringify(functionArgs)}`);
    logger.info(`Sender: ${sender || 'default'}`);

    // Import the view function executor
    const { executeViewFunction } = await import('../services/ptbExecuteService');
    const result = await executeViewFunction(
      functionTarget,
      functionArgs,
      network,
      sender
    );

    if (result.success) {
      logger.info(`View function execution successful`);
      res.json({
        success: true,
        data: result
      });
    } else {
      logger.error(`View function execution failed: ${result.error}`);
      res.status(400).json({
        success: false,
        message: result.error || 'View function execution failed'
      });
    }
  } catch (error) {
    logger.error('View function execution error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'View function execution failed'
    });
  }
});

router.post('/execute', async (req, res, _next) => {
  try {
    // Check if request contains commands array (PTB Builder) or functionTarget (Module Interface)
    if (req.body.commands && Array.isArray(req.body.commands)) {
      // Handle PTB Builder commands
      const { error, value } = executePTBCommandsSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false,
          message: error.details[0].message 
        });
      }

      const { commands, network } = value;
      
      logger.info(`Executing PTB commands with playground wallet`);
      logger.info(`Commands: ${JSON.stringify(commands)}`);
      
      // For now, if there's only one MoveCall command, extract it and use existing service
      if (commands.length === 1 && commands[0].type === 'MoveCall') {
        const cmd = commands[0];
        const functionTarget = cmd.target;
        const functionArgs = cmd.arguments || [];
        
        const result = await executePlaygroundWalletPTB(
          'ptb-builder', // Use a default projectId for PTB Builder
          functionTarget,
          functionArgs,
          network
        );
        
        // Check if execution was successful
        if (!result.success) {
          logger.error(`PTB execution failed: ${result.error}`);
          return res.status(400).json({
            success: false,
            error: result.error || 'PTB execution failed'
          });
        }
        
        logger.info(`PTB execution successful: ${result.transactionDigest}`);
        
        // Return in the expected format for PTB Builder
        res.json({
          success: true,
          transactionDigest: result.transactionDigest || result.digest,
          gasUsed: result.gasUsed,
          objectChanges: result.objectChanges,
          events: result.events,
          effects: result.effects,
          returnValues: result.returnValues // Include return values for view functions
        });
      } else {
        // TODO: Implement multi-command PTB execution
        throw new Error('Multi-command PTB execution not yet implemented');
      }
    } else {
      // Handle Module Interface format
      const { error, value } = executePTBSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false,
          message: error.details[0].message 
        });
      }

      const { projectId, functionTarget, functionArgs, network } = value;

      logger.info(`Executing PTB with playground wallet: ${functionTarget}`);
      logger.info(`Arguments: ${JSON.stringify(functionArgs)}`);

      const result = await executePlaygroundWalletPTB(
        projectId,
        functionTarget,
        functionArgs,
        network
      );

      logger.info(`PTB execution successful: ${result.transactionDigest}`);

      res.json({
        success: true,
        data: result
      });
    }
  } catch (error) {
    logger.error('PTB execution failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'PTB execution failed'
    });
  }
});

export default router;