
import {
  consumeCredits,
  refundConsumedCreditById,
} from '@/domains/account/infra/credit';
import { appendUserToResult, type User } from '@/domains/account/infra/user';
import { db } from '@/infra/adapters/db';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import { and, count, desc, eq } from 'drizzle-orm';

import { aiTask } from '@/config/db/schema';
import { AITaskStatus } from '@/extensions/ai';

const log = createUseCaseLogger({
  domain: 'ai',
  useCase: 'ai-task',
});

export type AITask = typeof aiTask.$inferSelect & {
  user?: User;
};
export type NewAITask = typeof aiTask.$inferInsert;
export type UpdateAITask = Partial<
  Omit<NewAITask, 'id' | 'createdAt' | 'creditId'>
>;

type AiTaskCreditRefundLog = {
  error: (message: string, meta?: unknown) => void;
};

export async function createAITask(newAITask: NewAITask) {
  const result = await db().transaction(async (tx) => {
    // 1. create task record
    const [taskResult] = await tx.insert(aiTask).values(newAITask).returning();

    if (newAITask.costCredits && newAITask.costCredits > 0) {
      // 2. consume credits
      const consumedCredit = await consumeCredits({
        userId: newAITask.userId,
        credits: newAITask.costCredits,
        scene: newAITask.scene,
        description: `generate ${newAITask.mediaType}`,
        metadata: JSON.stringify({
          type: 'ai-task',
          mediaType: taskResult.mediaType,
          taskId: taskResult.id,
        }),
      });

      // 3. update task record with consumed credit id
      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(aiTask)
          .set({ creditId: consumedCredit.id })
          .where(eq(aiTask.id, taskResult.id));
      }
    }

    return taskResult;
  });

  return result;
}

export async function findAITaskById(id: string) {
  const [result] = await db().select().from(aiTask).where(eq(aiTask.id, id));
  return result;
}

export async function updateAITaskById(id: string, updateAITask: UpdateAITask) {
  const [result] = await db()
    .update(aiTask)
    .set(updateAITask)
    .where(eq(aiTask.id, id))
    .returning();

  return result;
}

export async function failAITaskByIdAndRefundCredit({
  id,
  updateAITask,
  creditId,
  refundLog = log,
}: {
  id: string;
  updateAITask: UpdateAITask;
  creditId?: string | null;
  refundLog?: AiTaskCreditRefundLog;
}) {
  return db().transaction(async (tx) => {
    const trimmedCreditId = creditId?.trim();
    if (trimmedCreditId) {
      const refund = await refundConsumedCreditById(trimmedCreditId, tx);
      if (!refund.refunded && refund.reason === 'invalid_consumed_detail') {
        refundLog.error('credit: invalid consumedDetail payload, skip refund', {
          operation: 'refund-failed-task-credit',
          aiTaskId: id,
          creditId: trimmedCreditId,
        });
      }
    }

    const [result] = await tx
      .update(aiTask)
      .set({
        ...updateAITask,
        status: AITaskStatus.FAILED,
      })
      .where(eq(aiTask.id, id))
      .returning();

    return result;
  });
}

export async function getAITasksCount({
  userId,
  status,
  mediaType,
  provider,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    );

  return result?.count || 0;
}

export async function getAITasks({
  userId,
  status,
  mediaType,
  provider,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<AITask[]> {
  const result = await db()
    .select()
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}
