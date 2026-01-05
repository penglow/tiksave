import { pool, query } from './init.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding database...');
  
  try {
    // Create test user
    const passwordHash = await bcrypt.hash('testpassword123', 12);
    
    const userResult = await query(
      `INSERT INTO users (email, password_hash, display_name, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [
        'test@example.com',
        passwordHash,
        'Test User',
        JSON.stringify({
          enableVideoUpload: true,
          autoFileHighConfidence: true,
          notificationsEnabled: true,
          confidenceThreshold: 0.85,
          theme: 'system',
        }),
      ]
    );
    
    const userId = userResult.rows[0].id;
    console.log(`Created user: ${userId}`);
    
    // Create folders
    const folders = [
      { name: 'Japan', icon: '🇯🇵', children: [
        { name: 'Japan Food', icon: '🍜' },
        { name: 'Japan Hotels', icon: '🏨' },
        { name: 'Japan Attractions', icon: '⛩️' },
        { name: 'Japan Shopping', icon: '🛍️' },
      ]},
      { name: 'Korea', icon: '🇰🇷', children: [
        { name: 'Korea Food', icon: '🍲' },
        { name: 'Korea Hotels', icon: '🏨' },
        { name: 'Korea Attractions', icon: '🏛️' },
        { name: 'Korea Shopping', icon: '🛍️' },
      ]},
      { name: 'Gym', icon: '💪', children: [
        { name: 'Workouts', icon: '🏋️' },
        { name: 'Nutrition', icon: '🥗' },
        { name: 'Motivation', icon: '🔥' },
      ]},
      { name: 'Recipes', icon: '👨‍🍳', children: [
        { name: 'Quick Meals', icon: '⏱️' },
        { name: 'Desserts', icon: '🍰' },
        { name: 'Healthy', icon: '🥦' },
      ]},
    ];
    
    const folderIds: { [key: string]: string } = {};
    
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      
      const parentResult = await query(
        `INSERT INTO folders (user_id, name, icon_name, sort_order, is_default)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (user_id, name, parent_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [userId, folder.name, folder.icon, i]
      );
      
      const parentId = parentResult.rows[0].id;
      folderIds[folder.name] = parentId;
      
      for (let j = 0; j < folder.children.length; j++) {
        const child = folder.children[j];
        
        const childResult = await query(
          `INSERT INTO folders (user_id, name, parent_id, icon_name, sort_order, is_default)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (user_id, name, parent_id) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [userId, child.name, parentId, child.icon, j]
        );
        
        folderIds[child.name] = childResult.rows[0].id;
      }
    }
    
    console.log(`Created ${Object.keys(folderIds).length} folders`);
    
    // Create sample save items
    const sampleItems = [
      {
        sourceUrl: 'https://tiktok.com/@japanfoodguide/video/12345',
        rawSharedText: 'Best ramen in Tokyo! 🍜 #japan #tokyo #ramen #food #japantravel',
        status: 'ready',
        title: 'Best Ramen in Tokyo - Ichiran Review',
        transcriptText: 'This is the famous Ichiran ramen in Shibuya. The tonkotsu broth is incredibly rich...',
        topics: ['Japan', 'Food', 'Travel'],
        labels: ['ramen', 'restaurant', 'tokyo', 'noodles'],
        folderId: folderIds['Japan Food'],
        confidence: 0.92,
        creatorUsername: '@japanfoodguide',
        duration: 45,
      },
      {
        sourceUrl: 'https://tiktok.com/@tokyohotels/video/23456',
        rawSharedText: 'Room tour of Park Hyatt Tokyo! #japan #tokyo #hotel #luxury #travel',
        status: 'ready',
        title: 'Park Hyatt Tokyo Room Tour',
        transcriptText: 'Welcome to the Park Hyatt Tokyo, made famous by Lost in Translation...',
        topics: ['Japan', 'Hotels', 'Travel'],
        labels: ['hotel', 'room tour', 'luxury', 'tokyo'],
        folderId: folderIds['Japan Hotels'],
        confidence: 0.88,
        creatorUsername: '@tokyohotels',
        duration: 60,
      },
      {
        sourceUrl: 'https://tiktok.com/@gymfit/video/34567',
        rawSharedText: 'Full body workout no equipment needed! #gym #workout #fitness #exercise',
        status: 'ready',
        title: 'Full Body Workout - No Equipment',
        transcriptText: 'Today we are doing a 20-minute full body workout with no equipment...',
        topics: ['Fitness', 'Health'],
        labels: ['workout', 'exercise', 'fitness'],
        folderId: folderIds['Workouts'],
        confidence: 0.95,
        creatorUsername: '@gymfit',
        duration: 120,
      },
      {
        sourceUrl: 'https://tiktok.com/@traveler/video/45678',
        rawSharedText: 'Check out this temple in Kyoto! So beautiful! #japan #kyoto #temple',
        status: 'needs_review',
        title: 'Fushimi Inari Shrine Walk',
        transcriptText: 'The famous thousand torii gates at Fushimi Inari shrine...',
        topics: ['Japan', 'Travel'],
        labels: ['temple', 'shrine', 'kyoto', 'landmark'],
        folderId: null,
        predictedFolderId: folderIds['Japan Attractions'],
        confidence: 0.65,
        creatorUsername: '@traveler',
        duration: 55,
      },
      {
        sourceUrl: 'https://tiktok.com/@koreafood/video/56789',
        rawSharedText: 'Korean BBQ mukbang! #korea #seoul #kbbq #food #mukbang',
        status: 'processing',
        topics: [],
        labels: [],
        creatorUsername: '@koreafood',
      },
    ];
    
    for (const item of sampleItems) {
      await query(
        `INSERT INTO save_items (
          user_id, source_url, raw_shared_text, status, title, transcript_text,
          detected_topics, detected_labels, folder_id, predicted_folder_id,
          confidence, creator_username, duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT DO NOTHING`,
        [
          userId,
          item.sourceUrl,
          item.rawSharedText,
          item.status,
          item.title || null,
          item.transcriptText || null,
          item.topics || [],
          item.labels || [],
          item.folderId || null,
          item.predictedFolderId || null,
          item.confidence || null,
          item.creatorUsername || null,
          item.duration || null,
        ]
      );
    }
    
    console.log(`Created ${sampleItems.length} sample items`);
    
    console.log('\n✅ Seed completed successfully!');
    console.log('\nTest credentials:');
    console.log('  Email: test@example.com');
    console.log('  Password: testpassword123');
    
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);

