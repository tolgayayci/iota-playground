#!/usr/bin/env node

// Script to update GitHub avatars for existing users
// Run this script to backfill avatar URLs from GitHub OAuth metadata

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to add this to .env

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateUserAvatars() {
  try {
    console.log('Fetching all users from auth.users table...');
    
    // Get all users from auth.users table (requires service role key)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }
    
    console.log(`Found ${authUsers.users.length} users`);
    
    let updatedCount = 0;
    
    for (const authUser of authUsers.users) {
      const avatarUrl = authUser.user_metadata?.avatar_url;
      
      if (avatarUrl) {
        console.log(`Updating avatar for user ${authUser.email}...`);
        
        // Update the users table with the avatar URL
        const { error: updateError } = await supabase
          .from('users')
          .update({ avatar_url: avatarUrl })
          .eq('id', authUser.id);
        
        if (updateError) {
          console.error(`Error updating user ${authUser.email}:`, updateError);
        } else {
          updatedCount++;
          console.log(`✓ Updated avatar for ${authUser.email}`);
        }
      } else {
        console.log(`- No avatar URL found for ${authUser.email}`);
      }
    }
    
    console.log(`\nCompleted! Updated ${updatedCount} user avatars.`);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
updateUserAvatars();