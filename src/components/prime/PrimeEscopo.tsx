import React from 'react';
import { createPortal } from 'react-dom';
import { useConfig } from '../../ConfigContext';
import { legivelSobre } from './primeArte';
import './prime.css';

export function PrimeEscopo({ ativo, children }: { ativo: boolean; children: React.ReactNode }) {
  const { config } = useConfig();
  if (!ativo) return <>{children}</>;
  const cor = config.themeColor || '#04af06';
  return createPortal(
    <div className="prime-mod prime-ck" style={{ ['--ac' as string]: cor, ['--ac-ink' as string]: legivelSobre(cor) } as React.CSSProperties}>
      {children}
    </div>,
    document.body,
  );
}
