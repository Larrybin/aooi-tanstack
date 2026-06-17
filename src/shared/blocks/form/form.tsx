'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { useRouter } from '@/shared/blocks/common/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import {
  Form as FormComponent,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { formatMessageWithRequestId } from '@/shared/lib/api/request-id';
import type {
  FormField as FormFieldType,
  FormSubmit,
} from '@/shared/types/blocks/form';

import {
  buildFormDefaultValues,
  buildFormSchema,
  renderFormFieldControl,
  serializeFieldValue,
} from './field-registry';

export function Form<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TPassby = unknown,
>({
  title,
  description,
  fields,
  data,
  passby,
  submit,
}: {
  title?: string;
  description?: string;
  fields?: FormFieldType[];
  data?: TData;
  passby?: TPassby;
  submit?: FormSubmit<TPassby>;
}) {
  const resolvedFields = fields ?? [];

  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const FormSchema = buildFormSchema(resolvedFields);
  const defaultValues = buildFormDefaultValues({
    fields: resolvedFields,
    data: data as Record<string, unknown> | undefined,
  });

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  });

  async function onSubmit(submittedValues: z.infer<typeof FormSchema>) {
    const fieldsByName = new Map(
      resolvedFields
        .filter(
          (
            field
          ): field is (typeof resolvedFields)[number] & { name: string } =>
            Boolean(field.name)
        )
        .map((field) => [field.name, field])
    );

    if (!submit?.handler) return;

    setLoading(true);
    try {
      const formData = new FormData();

      for (const [key, value] of Object.entries(submittedValues)) {
        const field = fieldsByName.get(key);
        if (!field) continue;
        formData.append(key, serializeFieldValue({ field, value }));
      }

      const res = await submit.handler(formData, passby);

      if (!res) {
        throw new Error('No response received from server');
      }

      if (res.message) {
        const message = formatMessageWithRequestId(res.message, res.requestId);
        if (res.status === 'success') {
          toast.success(message);
        } else {
          toast.error(message);
        }
      }

      const redirectUrl = res.redirect_url;
      if (redirectUrl) {
        router.push(redirectUrl);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'submit form failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormComponent {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full space-y-0 pb-2 md:max-w-xl"
      >
        {title ? <h2 className="text-lg font-bold">{title}</h2> : null}
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
        <div className="mb-6 space-y-6">
          {resolvedFields.map((item, index) => {
            if (!item.name) {
              throw new Error(`Form field name is required at index ${index}.`);
            }

            return (
              <FormField
                key={`${item.name}-${index}`}
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <FormItem data-testid={`form-field-${item.name}`}>
                    <FormLabel>
                      {item.title}
                      {item.validation?.required && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </FormLabel>
                    <FormControl>
                      {renderFormFieldControl({
                        field: item,
                        formField: field,
                        data,
                      })}
                    </FormControl>
                    {item.tip && (
                      <FormDescription
                        dangerouslySetInnerHTML={{ __html: item.tip }}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          })}
        </div>
        {submit?.button && (
          <Button
            type="submit"
            variant={submit.button.variant}
            className="flex cursor-pointer items-center justify-center gap-2 font-semibold"
            disabled={loading}
            size={submit.button.size || 'sm'}
            data-testid="form-submit-button"
          >
            {loading ? (
              <Loader className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              submit.button.icon && (
                <SmartIcon
                  name={submit.button.icon as string}
                  className="size-4"
                />
              )
            )}
            {submit.button.title}
          </Button>
        )}
      </form>
    </FormComponent>
  );
}
