import { Mail, MessageSquare, Store, ShoppingBag, Hash as SlackIcon, MessagesSquare, Send, Camera as InstagramIcon, Users as FacebookIcon, Music2, Package } from 'lucide-react';
import { cn } from '../lib/utils';

const MAP: Record<string, { Icon: React.ComponentType<{ className?: string }>; label: string; color: string; bg: string }> = {
  email: { Icon: Mail, label: 'Email', color: '#4C7DF0', bg: 'rgba(76,125,240,0.12)' },
  chat: { Icon: MessageSquare, label: 'Live chat', color: '#21B8A6', bg: 'rgba(33,184,166,0.12)' },
  whatsapp: { Icon: MessageSquare, label: 'WhatsApp', color: '#25A65B', bg: 'rgba(37,166,91,0.12)' },
  instagram: { Icon: InstagramIcon, label: 'Instagram', color: '#D6487E', bg: 'rgba(214,72,126,0.12)' },
  messenger: { Icon: FacebookIcon, label: 'Messenger', color: '#2D7FF9', bg: 'rgba(45,127,249,0.12)' },
  telegram: { Icon: Send, label: 'Telegram', color: '#2AABEE', bg: 'rgba(42,171,238,0.12)' },
  slack: { Icon: SlackIcon, label: 'Slack', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  amazon: { Icon: ShoppingBag, label: 'Amazon', color: '#E08A1E', bg: 'rgba(240,164,60,0.14)' },
  ebay: { Icon: Store, label: 'eBay', color: '#3B7BB8', bg: 'rgba(59,123,184,0.12)' },
  etsy: { Icon: Store, label: 'Etsy', color: '#D2603A', bg: 'rgba(210,96,58,0.12)' },
  walmart: { Icon: ShoppingBag, label: 'Walmart', color: '#2E77BC', bg: 'rgba(46,119,188,0.12)' },
  shopify: { Icon: ShoppingBag, label: 'Shopify', color: '#5E8E3E', bg: 'rgba(94,142,62,0.14)' },
  woocommerce: { Icon: ShoppingBag, label: 'WooCommerce', color: '#7F54B3', bg: 'rgba(127,84,179,0.12)' },
  tiktok: { Icon: Music2, label: 'TikTok Shop', color: '#172B4D', bg: 'rgba(20,45,70,0.12)' },
  aliexpress: { Icon: Package, label: 'AliExpress', color: '#E43D33', bg: 'rgba(228,61,51,0.12)' },
  manual: { Icon: MessagesSquare, label: 'Manual', color: '#718096', bg: 'rgba(113,128,150,0.12)' },
};

export function ChannelIcon({ type, size = 'sm', className, showLabel }: { type: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; showLabel?: boolean }) {
  const meta = MAP[type] || MAP.manual;
  const sizes = { xs: 'h-5 w-5', sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-11 w-11' };
  const icons = { xs: 'h-2.5 w-2.5', sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={meta.label}>
      <span className={cn('inline-flex items-center justify-center rounded-md', sizes[size])} style={{ background: meta.bg, color: meta.color }}>
        <meta.Icon className={icons[size]} />
      </span>
      {showLabel && <span className="text-[12px] text-muted">{meta.label}</span>}
    </span>
  );
}

export const channelMetaFor = (type: string) => MAP[type] || MAP.manual;
export const channelLabel = (type: string) => (MAP[type] || MAP.manual).label;
