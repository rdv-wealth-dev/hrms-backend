import { z } from "zod";

export const CreateEventDto = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title cannot exceed 100 characters"),
  description: z.string().trim().optional(),
  date: z.string().datetime({ message: "Invalid date format. Expected ISO-8601 string." }),
});

export type CreateEventInput = z.infer<typeof CreateEventDto>;
