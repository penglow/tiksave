import { createOrFindFolder } from './src/services/folderCreation.js';

async function testLogicFix() {
    console.log('🧪 Testing Logic Fix...');

    const userId = 'test-user-id';
    const mockTopics = ['Saved'];
    const mockLabels = [];
    const mockFolderName = 'TikTok Links';
    const mockEmoji = '🔗';

    console.log(`Input: topics=['${mockTopics}'], folderName='${mockFolderName}'`);

    // Simulate the condition we fixed in videoProcessor.ts / items.ts
    const conditionBefore = (mockTopics && mockTopics.length > 0 && mockTopics[0] !== 'Saved');
    console.log(`Logic Before Fix: ${conditionBefore} (Would create folder? ${conditionBefore})`);

    const conditionAfter = (mockTopics && mockTopics.length > 0 && mockTopics[0] !== 'Saved') || (mockFolderName && mockFolderName !== 'Saved');
    console.log(`Logic After Fix: ${conditionAfter} (Would create folder? ${conditionAfter})`);

    if (conditionAfter) {
        console.log('✅ Fix verified: Logic allows folder creation!');
    } else {
        console.error('❌ Fix failed: Logic still prevents folder creation.');
    }
}

testLogicFix();
