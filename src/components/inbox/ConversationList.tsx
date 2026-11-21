import { memo } from 'react';
import { Check, Star, Paperclip, Clock, Flame } from 'lucide-react';
import { cn, priorityMeta, timeAgo } from '../../lib/utils';
import { Avatar, Badge, Checkbox, Skeleton } from '../ui';
import { ChannelIcon } from '../ChannelIcon';
import type { Conversation } from '../../lib/types';

interface Props {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (c: Conversation) => void;
  loading: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleStar: (c: Conversation) => void;
  emptyLabel?: string;
}

export const ConversationList = memo(function ConversationList({ conversations, selectedId, onSelect, loading, selected, onToggleSelect, onToggleStar, emptyLabel }: Props) {
  if (loading) return <div className="space-y-0.5 p-2"><SkeletonListInline /></div>;
  if (!conversations.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface3 text-muted">
          <Check className="h-5 w-5" />
        </div>
        <p className="text-[13px] font-semibold text-ink">{emptyLabel || 'Inbox zero'}</p>
        <p className="mt-1 max-w-[210px] text-[11.5px] leading-relaxed text-muted">
          Nothing matches this view. Try another filter or clear your search.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line/70">
      {conversations.map((c) => {
        const isActive = c.id === selectedId;
        const isChecked = selected.has(c.id);
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            className={cn('group relative cursor-pointer px-3 py-2.5 transition-colors',
              isActive ? 'bg-teal/[0.07]' : 'hover:bg-surface2/70',
              !isActive && c.unreadCount > 0 && 'bg-surface')}
          >
            {isActive && <span className="absolute inset-y-0 left-0 w-[2.5px] bg-teal" />}
            <div className="flex gap-2.5">
              <div className="relative shrink-0 pt-0.5">
                <Avatar name={c.customer.name} color={c.customer.color} size="sm" />
                {!isChecked ? (
                  <span className="absolute -bottom-1 -right-1 opacity-0 transition group-hover:opacity-100">
                    <Checkbox checked={false} onChange={() => onToggleSelect(c.id)} className="h-3.5 w-3.5 bg-surface" />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('truncate text-[12.5px]', c.unreadCount > 0 ? 'font-semibold text-ink' : 'font-medium text-ink/90')}>
                    {c.customer.name}
                  </span>
                  {c.priority === 'urgent' && <Flame className="h-3 w-3 shrink-0 text-danger" />}
                  {c.starred && <Star className="h-2.5 w-2.5 shrink-0 fill-warning text-warning" />}
                  <span className="ml-auto shrink-0 text-[10px] text-faint">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={cn('truncate text-[11.5px]', c.unreadCount > 0 ? 'font-medium text-ink' : 'text-muted')}>{c.subject}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <ChannelIcon type={c.channelType} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-[11px]">
                    {c.preview?.toLowerCase().startsWith('internal:') && <span className="mr-1 rounded bg-warning/12 px-1 py-px text-[9px] font-semibold uppercase text-warning">note</span>}
                    {c.previewAuthor && <span className="text-muted">{c.previewAuthor.split(' ')[0]}: </span>}
                    <span className="text-faint">{c.preview?.replace(/^internal:\s*/i, '').replace(/\s+/g, ' ').slice(0, 80)}</span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Badge tone={priorityMeta[c.priority]?.tone as any} className="!py-0 !text-[9.5px]">{priorityMeta[c.priority]?.label || c.priority}</Badge>
                  {c.status !== 'open' && <Badge tone={c.status === 'pending' ? 'amber' : c.status === 'resolved' ? 'green' : c.status === 'on_hold' ? 'violet' : 'blue'} className="!py-0 !text-[9.5px]">{c.status.replace('_', ' ')}</Badge>}
                  {c.slaState === 'breached' && <Badge tone="red" className="!py-0 !text-[9.5px]">SLA</Badge>}
                  {c.teamName && <span className="truncate text-[9.5px] text-faint">{c.teamName}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {c.messageCount > 3 && <span className="flex items-center gap-0.5 text-[9.5px] text-faint"><Paperclip className="h-2.5 w-2.5" />{c.messageCount}</span>}
                    {c.assignee ? <Avatar name={c.assignee.name} color={c.assignee.color} size="xs" className="!h-4 !w-4 !text-[8px]" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-line-strong text-[8px] text-faint" title="Unassigned">?</span>}
                  </span>
                </div>
              </div>
            </div>
            {c.unreadCount > 0 && !isActive && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal" />
            )}
          </div>
        );
      })}
    </div>
  );
});

function SkeletonListInline() {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-2.5 w-8" /></div>
            <Skeleton className="h-2.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
