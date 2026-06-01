import { z } from 'zod';

const boundedText = (max: number) =>
  z.preprocess((value) => (value == null ? '' : String(value)), z.string().max(max));

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

export const ContactsScanSchema = z.object({
  mode: z.enum(['backfill', 'weekly']).default('weekly'),
});

export const ContactUpsertSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const ContactIgnoreSchema = z.object({
  email: z.string().email().max(320),
});

export const CareerStatusSchema = z.object({
  id: z.string().uuid('Invalid job id'),
  status: z.enum(['new', 'reviewing', 'applied', 'passed']),
});

export const EmailSynthesisSchema = z.object({
  emails: z.array(z.object({
    from: boundedText(500),
    subject: boundedText(1000),
    snippet: boundedText(3000),
    date: boundedText(100),
  })).min(1, 'At least one email is required').max(50, 'At most 50 emails can be synthesized at once'),
});
