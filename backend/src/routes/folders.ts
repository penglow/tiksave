import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../database/init.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const foldersRouter = Router();

// Validation schemas
const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
  iconName: z.string().optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  iconName: z.string().optional(),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
});

// Get all folders
foldersRouter.get('/', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  const result = await query(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM save_items WHERE folder_id = f.id) as item_count
     FROM folders f
     WHERE f.user_id = $1
     ORDER BY f.sort_order, f.name`,
    [authReq.userId]
  );
  
  res.json({
    folders: result.rows.map(formatFolder),
  });
});

// Get single folder
foldersRouter.get('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  
  const result = await query(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM save_items WHERE folder_id = f.id) as item_count
     FROM folders f
     WHERE f.id = $1 AND f.user_id = $2`,
    [id, authReq.userId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('Folder not found', 404);
  }
  
  res.json(formatFolder(result.rows[0]));
});

// Create folder
foldersRouter.post('/', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  try {
    const { name, parentId, iconName, colorHex } = createFolderSchema.parse(req.body);
    
    // Verify parent folder exists and belongs to user
    if (parentId) {
      const parent = await query(
        'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
        [parentId, authReq.userId]
      );
      
      if (parent.rows.length === 0) {
        throw new AppError('Parent folder not found', 404);
      }
    }
    
    // Check for duplicate name
    const existing = await query(
      `SELECT id FROM folders 
       WHERE user_id = $1 AND name = $2 AND parent_id IS NOT DISTINCT FROM $3`,
      [authReq.userId, name, parentId]
    );
    
    if (existing.rows.length > 0) {
      throw new AppError('Folder with this name already exists', 400);
    }
    
    // Get next sort order
    const sortResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
       FROM folders 
       WHERE user_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [authReq.userId, parentId]
    );
    
    const sortOrder = sortResult.rows[0].next_order;
    
    // Create folder
    const result = await query(
      `INSERT INTO folders (user_id, name, parent_id, icon_name, color_hex, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [authReq.userId, name, parentId, iconName, colorHex, sortOrder]
    );
    
    const folder = formatFolder({ ...result.rows[0], item_count: 0 });
    
    res.status(201).json(folder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Update folder
foldersRouter.patch('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  
  try {
    const updates = updateFolderSchema.parse(req.body);
    
    // Verify folder exists and belongs to user
    const existing = await query(
      'SELECT * FROM folders WHERE id = $1 AND user_id = $2',
      [id, authReq.userId]
    );
    
    if (existing.rows.length === 0) {
      throw new AppError('Folder not found', 404);
    }
    
    // Build update query
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      setClause.push(`name = $${paramIndex}`);
      params.push(updates.name);
      paramIndex++;
    }
    
    if (updates.iconName !== undefined) {
      setClause.push(`icon_name = $${paramIndex}`);
      params.push(updates.iconName);
      paramIndex++;
    }
    
    if (updates.colorHex !== undefined) {
      setClause.push(`color_hex = $${paramIndex}`);
      params.push(updates.colorHex);
      paramIndex++;
    }
    
    if (updates.sortOrder !== undefined) {
      setClause.push(`sort_order = $${paramIndex}`);
      params.push(updates.sortOrder);
      paramIndex++;
    }
    
    if (setClause.length === 0) {
      return res.json(formatFolder(existing.rows[0]));
    }
    
    setClause.push(`updated_at = NOW()`);
    params.push(id);
    
    const result = await query(
      `UPDATE folders SET ${setClause.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );
    
    // Get item count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM save_items WHERE folder_id = $1',
      [id]
    );
    
    res.json(formatFolder({ 
      ...result.rows[0], 
      item_count: countResult.rows[0].count 
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Delete folder
foldersRouter.delete('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  
  // Check if folder exists and belongs to user
  const existing = await query(
    'SELECT is_default FROM folders WHERE id = $1 AND user_id = $2',
    [id, authReq.userId]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Folder not found', 404);
  }
  
  // Delete all items in this folder
  await query(
    'DELETE FROM save_items WHERE folder_id = $1',
    [id]
  );
  
  // Also delete items from child folders
  await query(
    `DELETE FROM save_items 
     WHERE folder_id IN (SELECT id FROM folders WHERE parent_id = $1)`,
    [id]
  );
  
  // Delete folder (cascade will delete children)
  await query('DELETE FROM folders WHERE id = $1', [id]);
  
  res.json({ success: true });
});

// Reorder folders
const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

foldersRouter.post('/reorder', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  try {
    const { orderedIds } = reorderSchema.parse(req.body);
    
    // Update sort order for each folder
    for (let i = 0; i < orderedIds.length; i++) {
      await query(
        'UPDATE folders SET sort_order = $1 WHERE id = $2 AND user_id = $3',
        [i, orderedIds[i], authReq.userId]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'orderedIds must be an array of valid UUIDs' });
    }
    throw error;
  }
});

// Helper function
function formatFolder(row: any) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    iconName: row.icon_name,
    colorHex: row.color_hex,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    rules: row.rules,
    itemCount: parseInt(row.item_count || '0'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

