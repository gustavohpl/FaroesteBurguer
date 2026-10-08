import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useConfig } from '../ConfigContext';

interface PixPaymentProps {
  amount: number;
  onClose: () => void;
  onSendMessage: () => void;
}

export function PixPayment({ amount, onClose, onSendMessage }: PixPaymentProps) {
  const { config } = useConfig();
  const [copied, setCopied] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  
  const PIX_KEY = config.manualPixKey || 'Chave não configurada';
  const WHATSAPP_NUMBER = config.whatsappNumber || '5564993392970';

  const handleCopyPixKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendReceipt = () => {
    onSendMessage();
    setReceiptSent(true);
    
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto overflow-hidden">
        <div className="bg-green-600 text-white p-3">
          <h2 className="text-lg font-bold text-center">Pagamento via PIX</h2>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center bg-green-50 dark:bg-zinc-800 p-3 rounded-lg border-2 border-green-200 dark:border-zinc-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Valor a pagar:</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-500">
              R$ {amount.toFixed(2).replace('.', ',')}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 font-medium text-center">
              💳 Copie a chave PIX para fazer o pagamento:
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-zinc-800 border-2 border-gray-300 dark:border-zinc-700 rounded-lg p-2 flex items-center justify-between">
                <span className="font-mono text-base font-bold text-gray-800 dark:text-gray-200">
                  {PIX_KEY}
                </span>
                <button
                  onClick={handleCopyPixKey}
                  className={`ml-2 p-2 rounded-lg transition-all ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  title="Copiar chave PIX"
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            {copied && (
              <p className="text-green-600 dark:text-green-500 text-xs mt-1 text-center font-medium">
                ✓ Chave PIX copiada!
              </p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-400 font-medium mb-1">
              📋 Instruções:
            </p>
            <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5 list-decimal list-inside">
              <li>Copie a chave PIX acima</li>
              <li>Abra o app do seu banco e faça o PIX</li>
              <li>Realize o pagamento de <strong>R$ {amount.toFixed(2).replace('.', ',')}</strong></li>
              <li>Envie o comprovante pelo WhatsApp clicando no botão abaixo</li>
            </ol>
          </div>

          <div className="bg-amber-50 dark:bg-zinc-800 border-2 border-amber-300 dark:border-zinc-700 rounded-lg p-3">
            <p className="text-amber-900 dark:text-amber-400 font-bold text-center text-sm mb-1">
              ⚠️ IMPORTANTE
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 text-center">
              Após realizar o pagamento, não esqueça de enviar o comprovante pelo WhatsApp para confirmarmos seu pedido!
            </p>
          </div>

          <button
            onClick={handleSendReceipt}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-base transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Enviar Comprovante via WhatsApp
          </button>

          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}