import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  return (
    <a
      href={buildWhatsAppUrl('Assalamualaikum! I have a question about Madina Cotton Shop products.')}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110"
      title="Chat on WhatsApp"
    >
      <MessageCircle size={28} />
    </a>
  );
}
