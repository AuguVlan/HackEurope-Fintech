import React from 'react';
import { Card } from './ui';
import { formatTime } from '../lib/utils';
import { Send, FileText, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import type { ActivityItem } from '../api';

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const IconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Send,
  FileText,
  CheckCircle2,
  TrendingUp,
  Clock,
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted/10 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="col-span-1">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">Activity Feed</h3>
        <p className="text-muted-foreground text-sm">Recent ledger events</p>
      </div>

      <div className="space-y-4">
        {activities.length > 0 ? (
          activities.map((activity) => {
            const IconComponent = IconMap[activity.icon] || Clock;
            const getActivityColor = (type: string) => {
              switch (type) {
                case 'payout_executed':
                  return 'from-primary to-blue-600';
                case 'obligation_created':
                  return 'from-accent to-purple-600';
                case 'settlement_batch':
                  return 'from-secondary to-emerald-600';
                case 'topup':
                  return 'from-yellow-500 to-orange-600';
                case 'payout_queued':
                  return 'from-yellow-400 to-yellow-600';
                default:
                  return 'from-gray-500 to-gray-700';
              }
            };

            return (
              <div key={activity.id} className="flex gap-3 py-3 border-b border-border/10 last:border-0">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getActivityColor(activity.type)} flex items-center justify-center flex-shrink-0 mt-1`}>
                  <IconComponent className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(activity.timestamp)}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No activity yet</p>
          </div>
        )}
      </div>
    </Card>
  );
};
