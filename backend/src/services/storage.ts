/**
 * Azure Blob Storage helpers for video upload URLs and blob lifecycle.
 */

// --- imports ---

import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

// --- constants ---

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'tiksave-videos';

let blobServiceClient: BlobServiceClient | null = null;

// --- helpers ---

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

// --- handlers ---

/** Generate a signed SAS URL for uploading a video blob for an item. */
export async function generateUploadUrl(itemId: string): Promise<{
  uploadURL: string;
  blobName: string;
  expiresAt: Date;
}> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);

  await containerClient.createIfNotExists();

  const blobName = `${itemId}/${uuidv4()}.mp4`;
  const blobClient = containerClient.getBlockBlobClient(blobName);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const sasUrl = await blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('cw'),
    expiresOn: expiresAt,
    contentType: 'video/mp4',
  });

  return {
    uploadURL: sasUrl,
    blobName,
    expiresAt,
  };
}

/** Generate a read-only SAS URL for an existing blob. */
export async function getBlobUrl(blobName: string): Promise<string> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return await blobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: expiresAt,
  });
}

/** Delete a blob if it exists. */
export async function deleteBlob(blobName: string): Promise<void> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  await blobClient.deleteIfExists();
}

/** List blob names under a prefix. */
export async function listBlobs(prefix: string): Promise<string[]> {
  const client = getBlobServiceClient();
  const containerClient = client.getContainerClient(containerName);

  const blobs: string[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobs.push(blob.name);
  }

  return blobs;
}
