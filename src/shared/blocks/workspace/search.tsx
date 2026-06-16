'use client';

import { useState } from 'react';

import { Input } from '@/shared/components/ui/input';
import type { Search as SearchType } from '@/shared/types/blocks/common';

export function Search({ search }: { search: SearchType }) {
  const [value, setValue] = useState(search.value || '');

  const handleSearch = () => {
    if (value === search.value) {
      return;
    }

    setValue(value);

    const params = new URLSearchParams(globalThis.location.search);
    params.delete('page');

    params.set(search.name, value);

    if (value) {
      params.set(search.name, value);
    } else {
      params.delete(search.name);
    }

    globalThis.location.assign(`?${params.toString()}`);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        placeholder={search.placeholder || ''}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="w-full"
      />
    </div>
  );
}
