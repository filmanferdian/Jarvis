import { z } from 'zod';

export const CreateTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(500).trim(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
});

export const UpdateTaskSchema = z.object({
  notionPageId: z.string().min(1, 'notionPageId is required'),
  status: z.enum(['Not Started', 'In Progress', 'Done']).optional(),
});

export const KpiPatchSchema = z.object({
  id: z.string().min(1, 'KPI id is required'),
  value: z.number().optional(),
});

export const KpiCreateSchema = z.object({
  domainId: z.string().min(1, 'domainId is required'),
  name: z.string().min(1, 'name is required').max(200),
  value: z.number().optional(),
  target: z.number().optional(),
  unit: z.string().max(50).optional(),
});

export const VoiceIntentSchema = z.object({
  transcript: z.string().min(1, 'transcript is required').max(5000).trim(),
});

export const TtsSchema = z.object({
  text: z.string().min(1, 'text is required').max(5000),
});

export const WeightSchema = z.object({
  weight_kg: z.number().min(20).max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
