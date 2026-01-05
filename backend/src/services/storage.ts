import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'tiksave-videos';

let blobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

export async function generateUploadUrl(itemId: string): Promise<{
  uploadURL: string;
  blobName: string;
  expiresAt: Date;
}> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  
  // Ensure container exists
  await containerClient.createIfNotExists();
  
  // Generate unique blob name
  const blobName = `${itemId}/${uuidv4()}.mp4`;
  const blobClient = containerClient.getBlockBlobClient(blobName);
  
  // Set expiration time (1 hour)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  
  // Generate SAS URL for upload
  const sasUrl = await blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('cw'), // create and write
    expiresOn: expiresAt,
    contentType: 'video/mp4',
  });
  
  return {
    uploadURL: sasUrl,
    blobName,
    expiresAt,
  };
}

export async function getBlobUrl(blobName: string): Promise<string> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);
  
  // Generate read-only SAS URL (valid for 24 hours)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  return await blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: expiresAt,
  });
}

export async function deleteBlob(blobName: string): Promise<void> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);
  
  await blobClient.deleteIfExists();
}

export async function listBlobs(prefix: string): Promise<string[]> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  
  const blobs: string[] = [];
  
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobs.push(blob.name);
  }
  
  return blobs;
}

