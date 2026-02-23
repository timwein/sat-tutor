'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ParentPinDialog } from './parent-pin-dialog';
import { ParentOverview } from './parent-overview';
import { ParentDetailedView } from './parent-detailed-view';
import { ParentAlerts } from './parent-alerts';
import type { ParentDashboardData } from '@/lib/parent-dashboard';

interface ParentDashboardShellProps {
  studentId: string;
  hasPinSetup: boolean;
}

type AuthState = 'loading' | 'needs-setup' | 'needs-auth' | 'authenticated';

export function ParentDashboardShell({
  studentId,
  hasPinSetup,
}: ParentDashboardShellProps) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinMode, setPinMode] = useState<'setup' | 'verify'>('verify');
  const [dashboardData, setDashboardData] =
    useState<ParentDashboardData | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/parent/dashboard?student_id=${encodeURIComponent(studentId)}`
      );
      if (res.ok) {
        const data: ParentDashboardData = await res.json();
        setDashboardData(data);
      }
    } catch {
      // Failed to load data
    } finally {
      setLoadingData(false);
    }
  }, [studentId]);

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/parent/check-auth');
        const data = await res.json();
        if (data.authenticated && data.studentId === studentId) {
          setAuthState('authenticated');
        } else if (!hasPinSetup) {
          setAuthState('needs-setup');
        } else {
          setAuthState('needs-auth');
          setPinDialogOpen(true);
        }
      } catch {
        if (!hasPinSetup) {
          setAuthState('needs-setup');
        } else {
          setAuthState('needs-auth');
        }
      }
    }

    checkAuth();
  }, [studentId, hasPinSetup]);

  // Fetch data when authenticated
  useEffect(() => {
    if (authState === 'authenticated') {
      fetchDashboardData();
    }
  }, [authState, fetchDashboardData]);

  function handlePinSuccess() {
    setPinDialogOpen(false);
    if (pinMode === 'setup') {
      // After setup, user needs to verify
      setAuthState('needs-auth');
      setPinDialogOpen(true);
      setPinMode('verify');
    } else {
      setAuthState('authenticated');
    }
  }

  function handleAlertDismissed(alertId: string) {
    if (!dashboardData) return;
    setDashboardData({
      ...dashboardData,
      alerts: dashboardData.alerts.filter((a) => a.id !== alertId),
    });
  }

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Needs setup state
  if (authState === 'needs-setup') {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Set Up Parent Access</CardTitle>
            <CardDescription>
              Create a PIN to protect the parent dashboard. This keeps student
              analytics secure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              The parent dashboard provides a comprehensive view of your
              student&apos;s SAT prep journey, including:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-sm text-gray-600">
              <li>Predicted score and trend</li>
              <li>Total study time this week/month</li>
              <li>Session frequency and consistency</li>
              <li>Top 3 current weaknesses</li>
              <li>Detailed skill analytics and error rate trends</li>
              <li>Alerts for study gaps or skill regression</li>
            </ul>
            <Button
              onClick={() => {
                setPinMode('setup');
                setPinDialogOpen(true);
              }}
            >
              Set Up Parent PIN
            </Button>
          </CardContent>
        </Card>

        <ParentPinDialog
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
          onSuccess={handlePinSuccess}
          studentId={studentId}
          mode={pinMode}
        />
      </>
    );
  }

  // Needs auth state
  if (authState === 'needs-auth') {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Parent Dashboard Locked</CardTitle>
            <CardDescription>
              Enter your PIN to view your student&apos;s analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setPinDialogOpen(true)}>
              Enter PIN
            </Button>
          </CardContent>
        </Card>

        <ParentPinDialog
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
          onSuccess={handlePinSuccess}
          studentId={studentId}
          mode="verify"
        />
      </>
    );
  }

  // Authenticated — show dashboard
  if (loadingData || !dashboardData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading dashboard data...</div>
      </div>
    );
  }

  const unreadAlertCount = dashboardData.alerts.length;

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="detailed">Detailed Analytics</TabsTrigger>
        <TabsTrigger value="alerts" className="gap-2">
          Alerts
          {unreadAlertCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-1 h-5 min-w-5 px-1.5 text-xs"
            >
              {unreadAlertCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <ParentOverview data={dashboardData} />
      </TabsContent>

      <TabsContent value="detailed">
        <ParentDetailedView
          data={dashboardData}
          allSkillRatings={dashboardData.allSkillRatings}
        />
      </TabsContent>

      <TabsContent value="alerts">
        <ParentAlerts
          alerts={dashboardData.alerts}
          onAlertDismissed={handleAlertDismissed}
        />
      </TabsContent>
    </Tabs>
  );
}
