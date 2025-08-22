import { Router } from 'express';
import Joi from 'joi';
import { executePlaygroundWalletPTB } from '../services/ptbExecuteService';
import { logger } from '../utils/logger';

const router = Router();

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

router.post('/execute', async (req, res, next) => {
  try {
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
  } catch (error) {
    logger.error('PTB execution failed:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'PTB execution failed'
    });
  }
});

export default router;