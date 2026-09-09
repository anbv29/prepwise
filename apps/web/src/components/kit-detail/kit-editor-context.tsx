'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import type { Kit, KitRecord } from '@/types/kit';

interface UpdateOptions {
  message?: string;
  silent?: boolean;
}

interface KitEditorValue {
  isSaving: boolean;
  kit: Kit;
  updateKit: (updater: (draft: Kit) => void, options?: UpdateOptions) => void;
}

const KitEditorContext = createContext<KitEditorValue | null>(null);

function normalizeKit(kit: Kit) {
  const requirementIds = new Set(kit.role.requirements.map((requirement) => requirement.id));
  const questionIds = new Set(kit.questions.map((question) => question.id));

  kit.questions.forEach((question) => {
    question.requirement_ids = question.requirement_ids.filter((id) => requirementIds.has(id));
  });
  kit.flashcards.forEach((card) => {
    card.requirement_ids = card.requirement_ids.filter((id) => requirementIds.has(id));
  });
  kit.schedule.days.forEach((day) => {
    day.question_ids = day.question_ids.filter((id) => questionIds.has(id));
  });
  kit.coverage.uncovered_requirement_ids = kit.role.requirements
    .filter(
      (requirement) =>
        !kit.questions.some((question) => question.requirement_ids.includes(requirement.id)),
    )
    .map((requirement) => requirement.id);

  return kit;
}

export function KitEditorProvider({
  children,
  kit,
  kitId,
}: {
  children: ReactNode;
  kit: Kit;
  kitId: string;
}) {
  const queryClient = useQueryClient();
  const latestSave = useRef(0);
  const saveMutation = useMutation({
    mutationFn: ({
      nextKit,
    }: {
      nextKit: Kit;
      options: UpdateOptions;
      previous: KitRecord;
      sequence: number;
    }) => api.updateKit(kitId, nextKit),
    onSuccess: (record, variables) => {
      if (variables.sequence === latestSave.current) {
        queryClient.setQueryData(['kit', kitId], record);
      }
      void queryClient.invalidateQueries({ queryKey: ['kits'] });
      if (!variables.options.silent) toast.success(variables.options.message ?? 'Changes saved');
    },
    onError: (_error, variables) => {
      if (variables.sequence === latestSave.current) {
        queryClient.setQueryData(['kit', kitId], variables.previous);
        toast.error('That change could not be saved. Your previous version was restored.');
      }
    },
  });

  const updateKit = useCallback(
    (updater: (draft: Kit) => void, options: UpdateOptions = {}) => {
      const previous = queryClient.getQueryData<KitRecord>(['kit', kitId]);
      if (!previous?.kit) return;

      const nextKit = structuredClone(previous.kit);
      updater(nextKit);
      normalizeKit(nextKit);
      queryClient.setQueryData<KitRecord>(['kit', kitId], {
        ...previous,
        kit: nextKit,
        updatedAt: new Date().toISOString(),
      });
      latestSave.current += 1;
      saveMutation.mutate({ nextKit, options, previous, sequence: latestSave.current });
    },
    [kitId, queryClient, saveMutation],
  );

  const value = useMemo(
    () => ({ isSaving: saveMutation.isPending, kit, updateKit }),
    [kit, saveMutation.isPending, updateKit],
  );

  return <KitEditorContext.Provider value={value}>{children}</KitEditorContext.Provider>;
}

export function useKitEditor() {
  const value = useContext(KitEditorContext);
  if (!value) throw new Error('useKitEditor must be used inside KitEditorProvider.');
  return value;
}
