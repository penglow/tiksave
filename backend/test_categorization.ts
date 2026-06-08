/** Manual script: exercises categorization / folder-creation paths against mocked indexer output. */
import { analyzeUrlOnly } from './src/services/videoIndexer.js';
import { createOrFindFolder } from './src/services/folderCreation.js';

// Mock specific environment variables if needed
// process.env.OPENAI_API_KEY = '...'; 

async function testCategorization() {
    const userId = 'test-user-id';

    console.log('🧪 Starting Categorization Test...');

    // 1. Test Creator Fallback (Simulate AI failure but Creator found)
    console.log('\n👤 Testing Creator Fallback (Metadata found, AI fails)...');
    const creatorAnalysis = {
        topics: ['Creator > ramen_lover'], // Simulated fallback logic result
        labels: [],
        folderName: 'ramen_lover',
        folderEmoji: '👤',
        creator: 'ramen_lover'
    };

    try {
        const folder = await createOrFindFolder(
            userId,
            creatorAnalysis.topics,
            creatorAnalysis.labels,
            creatorAnalysis.folderName,
            creatorAnalysis.folderEmoji
        );
        if (folder) {
            console.log(`✅ Creator Folder Created: "${folder.folderName}" (ID: ${folder.folderId})`);
        } else {
            console.log('❌ Creator Folder creation failed');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }

    // 2. Test Absolute Fallback (No metadata, no creator)
    console.log('\n🔗 Testing Absolute Fallback (No metadata)...');
    const fallbackAnalysis = {
        topics: ['TikToks'],
        labels: [],
        folderName: 'TikTok Links',
        folderEmoji: '🔗'
    };

    try {
        const folder = await createOrFindFolder(
            userId,
            fallbackAnalysis.topics,
            fallbackAnalysis.labels,
            fallbackAnalysis.folderName,
            fallbackAnalysis.folderEmoji
        );
        if (folder) {
            console.log(`✅ Fallback Folder Created: "${folder.folderName}" (ID: ${folder.folderId})`);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}
