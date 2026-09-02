/* ─────────────────────────────────────────────────────────────
   SubscriptionsPage – Configure Plans, Pricing & Subscriber Entitlements
   Luxury SYD FLOWS Design System
   ───────────────────────────────────────────────────────────── */
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout/AppLayout';
import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal';
import {
  getSubscriptionPlansConfig,
  saveSubscriptionPlansConfig,
  getAllSubscriptionRequests,
  approveSubscriptionRequest,
  revokeUserSubscription,
  deleteSubscriptionRequest,
} from '@/services/firebase/firestore';
import { DEFAULT_SUBSCRIPTION_CONFIG } from '@/constants';
import type { SubscriptionPlansConfig, SubscriptionRequestRecord } from '@/types';
import styles from './SubscriptionsPage.module.css';

export function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'requests'>('plans');
  const [config, setConfig] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_CONFIG);
  const [requests, setRequests] = useState<SubscriptionRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'cancelled'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal states
  const [modalAction, setModalAction] = useState<{
    type: 'approve' | 'revoke' | 'delete';
    request: SubscriptionRequestRecord;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [fetchedConfig, fetchedRequests] = await Promise.all([
        getSubscriptionPlansConfig(),
        getAllSubscriptionRequests(),
      ]);
      setConfig(fetchedConfig);
      setRequests(fetchedRequests);
    } catch (err) {
      console.error('Failed to load subscription data:', err);
      showToast('Error loading subscription data');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleSaveConfig(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await saveSubscriptionPlansConfig(config);
      showToast('Subscription pricing & plans synced to mobile app live! 🚀');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save subscription plans');
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    setConfig(DEFAULT_SUBSCRIPTION_CONFIG);
    showToast('Reset form to default plan values. Click Save to publish.');
  }

  function handlePlanChange(index: number, field: string, value: any) {
    setConfig((prev) => {
      const currentPlans = Array.isArray(prev?.plans) && prev.plans.length > 0
        ? [...prev.plans]
        : [...DEFAULT_SUBSCRIPTION_CONFIG.plans];
      currentPlans[index] = {
        ...currentPlans[index],
        [field]: value,
      };
      return {
        ...prev,
        plans: currentPlans,
      };
    });
  }

  async function handleConfirmModal() {
    if (!modalAction) return;
    setActionLoading(true);
    const { type, request } = modalAction;

    try {
      if (type === 'approve') {
        await approveSubscriptionRequest(request.userId, request.id, request.planId);
        showToast(`Approved subscription for ${request.userEmail || request.userId} 🎉`);
      } else if (type === 'revoke') {
        await revokeUserSubscription(request.userId, request.id);
        showToast(`Revoked subscription for ${request.userEmail || request.userId}`);
      } else if (type === 'delete') {
        await deleteSubscriptionRequest(request.userId, request.id);
        showToast(`Deleted request for ${request.userEmail || request.userId}`);
      }
      setModalAction(null);
      const updated = await getAllSubscriptionRequests();
      setRequests(updated);
    } catch (err: any) {
      showToast(err?.message || 'Operation failed');
    } finally {
      setActionLoading(false);
    }
  }

  const filteredRequests = requests.filter((req) => {
    const matchesQuery =
      (req.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.userId || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return req.status === 'pending';
    if (statusFilter === 'approved') return req.status === 'approved' || req.status === 'active';
    if (statusFilter === 'cancelled') return req.status === 'cancelled' || req.status === 'rejected';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const currentPlans = Array.isArray(config?.plans) && config.plans.length > 0
    ? config.plans
    : DEFAULT_SUBSCRIPTION_CONFIG.plans;

  const annualPlan = currentPlans.find((p) => p.id === 'annual') || currentPlans[0] || DEFAULT_SUBSCRIPTION_CONFIG.plans[0];
  const monthlyPlan = currentPlans.find((p) => p.id === 'monthly') || currentPlans[1] || DEFAULT_SUBSCRIPTION_CONFIG.plans[1];

  return (
    <AppLayout>
      <div className={styles.container}>
        {/* Top Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              <div className={styles.titleIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              Subscription Management
            </h1>
            <p className={styles.subtitle}>
              Configure pricing, discounts, trial offers, and approve customer subscriber entitlements.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.saveBtnPrimary}
              onClick={() => handleSaveConfig()}
              disabled={saving}
            >
              {saving ? (
                'Syncing...'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save & Sync Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'plans' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Plans & Pricing Settings</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Subscriber Requests</span>
            {pendingCount > 0 && <span className={styles.badgeCount}>{pendingCount}</span>}
          </button>
        </div>

        {/* Tab 1: Plans & Pricing Settings */}
        {activeTab === 'plans' && (
          <form onSubmit={handleSaveConfig} className={styles.plansGrid}>
            <div className={styles.formColumn}>
              {/* Card 1: Screen Tagline & Hero Copy */}
              <div className={styles.cardSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleGroup}>
                    <div className={styles.sectionTitleIcon}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <h3 className={styles.sectionTitle}>Screen Branding & Hero Copy</h3>
                  </div>
                  <span className={styles.sectionTag}>Mobile Header</span>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Top Badge Tagline
                    <span className={styles.labelHint}>Displays inside pill tag</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={config.heroTagline}
                    onChange={(e) => setConfig({ ...config, heroTagline: e.target.value })}
                    placeholder="e.g. PERSONALISED WELLNESS"
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Hero Title
                      <span className={styles.labelHint}>Main value proposition</span>
                    </label>
                    <textarea
                      rows={2}
                      className={styles.textarea}
                      value={config.heroTitle}
                      onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
                      placeholder="e.g. Feel supported\nin every phase."
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Hero Subtitle
                      <span className={styles.labelHint}>Supporting details</span>
                    </label>
                    <textarea
                      rows={2}
                      className={styles.textarea}
                      value={config.heroSubtitle}
                      onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })}
                      placeholder="Unlock the complete workout library..."
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Annual Plan (Best Value) */}
              {annualPlan && (
                <div className={`${styles.cardSection} ${styles.cardSectionHighlight}`}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitleGroup}>
                      <div className={styles.sectionTitleIcon} style={{ color: 'var(--color-primary)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </div>
                      <h3 className={styles.sectionTitle}>Annual Subscription Plan</h3>
                    </div>
                    <span className={styles.sectionTag}>Featured Plan</span>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Plan Title</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={annualPlan.title}
                        onChange={(e) => handlePlanChange(0, 'title', e.target.value)}
                        placeholder="Annual Plan"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Badge Label</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={annualPlan.badge || ''}
                        onChange={(e) => handlePlanChange(0, 'badge', e.target.value)}
                        placeholder="BEST VALUE"
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Headline Price (e.g. $4.99)</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={annualPlan.price}
                        onChange={(e) => handlePlanChange(0, 'price', e.target.value)}
                        placeholder="$4.99"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Billing Period Label</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={annualPlan.period}
                        onChange={(e) => handlePlanChange(0, 'period', e.target.value)}
                        placeholder="/ month (billed annually)"
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Trial / Offer Subtitle</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={annualPlan.subtitle}
                        onChange={(e) => handlePlanChange(0, 'subtitle', e.target.value)}
                        placeholder="First 7 days free, then $59.99/yr"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Total Charged Detail</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={annualPlan.detail}
                        onChange={(e) => handlePlanChange(0, 'detail', e.target.value)}
                        placeholder="$59.99 charged annually"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Card 3: Monthly Plan */}
              {monthlyPlan && (
                <div className={styles.cardSection}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitleGroup}>
                      <div className={styles.sectionTitleIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <h3 className={styles.sectionTitle}>Monthly Subscription Plan</h3>
                    </div>
                    <span className={styles.sectionTag} style={{ background: 'var(--color-surface)' }}>Standard Plan</span>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Plan Title</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={monthlyPlan.title}
                        onChange={(e) => handlePlanChange(1, 'title', e.target.value)}
                        placeholder="Monthly Plan"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Price (e.g. $9.99)</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={monthlyPlan.price}
                        onChange={(e) => handlePlanChange(1, 'price', e.target.value)}
                        placeholder="$9.99"
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Subtitle</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={monthlyPlan.subtitle}
                        onChange={(e) => handlePlanChange(1, 'subtitle', e.target.value)}
                        placeholder="Flexible, cancel anytime"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Billing Detail</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={monthlyPlan.detail}
                        onChange={(e) => handlePlanChange(1, 'detail', e.target.value)}
                        placeholder="Billed monthly"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Sticky Action Footer */}
              <div className={styles.stickyFooter}>
                <button type="button" className={styles.resetBtnSecondary} onClick={handleResetDefaults}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  Reset Defaults
                </button>
                <button type="submit" className={styles.saveBtnPrimary} disabled={saving}>
                  {saving ? (
                    'Syncing...'
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Save & Sync to App
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Mobile Preview Column */}
            <div className={styles.previewStickyWrapper}>
              <div className={styles.previewHeading}>
                <span className={styles.previewHeadingTitle}>Live App Preview</span>
                <span className={styles.liveDot}>Syncing Live</span>
              </div>

              <div className={styles.previewPhone}>
                <div className={styles.previewNotch} />
                <div className={styles.previewTagline}>SYD FLOWS PREMIUM</div>
                <div className={styles.previewAppTitle}>Upgrade your flow</div>

                {/* Hero preview */}
                <div className={styles.previewHeroCard}>
                  <div className={styles.previewHeroTag}>{config.heroTagline || 'PERSONALISED WELLNESS'}</div>
                  <div className={styles.previewHeroTitle}>{config.heroTitle}</div>
                  <div className={styles.previewHeroSubtitle}>{config.heroSubtitle}</div>
                </div>

                <div className={styles.previewPlansSectionTitle}>CHOOSE YOUR PLAN</div>

                {/* Annual Plan Card Preview */}
                {annualPlan && (
                  <div className={styles.previewPlanCard}>
                    <div>
                      <div className={styles.previewPlanTitle}>
                        {annualPlan.title}
                        {annualPlan.badge && <span className={styles.previewBadge}>{annualPlan.badge}</span>}
                      </div>
                      <div className={styles.previewPlanSubtitle}>{annualPlan.subtitle}</div>
                      <div className={styles.previewPlanDetail}>{annualPlan.detail}</div>
                    </div>
                    <div>
                      <div className={styles.previewPlanPrice}>{annualPlan.price}</div>
                      <div className={styles.previewPlanPeriod}>{annualPlan.period}</div>
                    </div>
                  </div>
                )}

                {/* Monthly Plan Card Preview */}
                {monthlyPlan && (
                  <div className={`${styles.previewPlanCard} ${styles.previewPlanCardSecondary}`}>
                    <div>
                      <div className={styles.previewPlanTitle}>{monthlyPlan.title}</div>
                      <div className={styles.previewPlanSubtitle}>{monthlyPlan.subtitle}</div>
                      <div className={styles.previewPlanDetail}>{monthlyPlan.detail}</div>
                    </div>
                    <div>
                      <div className={styles.previewPlanPrice}>{monthlyPlan.price}</div>
                      <div className={styles.previewPlanPeriod}>{monthlyPlan.period}</div>
                    </div>
                  </div>
                )}

                <div className={styles.previewMainButton}>
                  Start 7-day free trial
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: User Requests & Entitlements */}
        {activeTab === 'requests' && (
          <div className={styles.requestsCard}>
            {/* Toolbar */}
            <div className={styles.tableToolbar}>
              <div className={styles.searchBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by email, name or UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className={styles.filterGroup}>
                {(['all', 'pending', 'approved', 'cancelled'] as const).map((filter) => (
                  <button
                    key={filter}
                    className={`${styles.filterBtn} ${statusFilter === filter ? styles.filterBtnActive : ''}`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className={styles.tableWrapper}>
              {loading ? (
                <div className={styles.emptyState}>Loading subscription requests...</div>
              ) : filteredRequests.length === 0 ? (
                <div className={styles.emptyState}>
                  {searchQuery || statusFilter !== 'all'
                    ? 'No requests match your current search/filter.'
                    : 'No subscription requests found.'}
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Selected Plan</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>{req.displayName || 'App User'}</span>
                            <span className={styles.userEmail}>{req.userEmail || req.userId}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{req.planId} Plan</span>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              req.status === 'approved' || req.status === 'active'
                                ? styles.statusApproved
                                : req.status === 'cancelled' || req.status === 'rejected'
                                ? styles.statusCancelled
                                : styles.statusPending
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                            {req.source || 'Mobile App'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actionBtns}>
                            {req.status !== 'approved' && req.status !== 'active' && (
                              <button
                                className={styles.approveBtn}
                                onClick={() => setModalAction({ type: 'approve', request: req })}
                              >
                                Approve & Unlock
                              </button>
                            )}

                            {(req.status === 'approved' || req.status === 'active') && (
                              <button
                                className={styles.revokeBtn}
                                onClick={() => setModalAction({ type: 'revoke', request: req })}
                              >
                                Revoke Access
                              </button>
                            )}

                            <button
                              className={styles.deleteBtn}
                              title="Delete request"
                              onClick={() => setModalAction({ type: 'delete', request: req })}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={!!modalAction}
          title={
            modalAction?.type === 'approve'
              ? 'Approve Subscription'
              : modalAction?.type === 'revoke'
              ? 'Revoke Premium Subscription'
              : 'Delete Subscription Request'
          }
          message={
            modalAction?.type === 'approve'
              ? `Are you sure you want to approve this subscription and unlock premium features for ${
                  modalAction.request.userEmail || modalAction.request.userId
                }?`
              : modalAction?.type === 'revoke'
              ? `Are you sure you want to revoke premium access for ${
                  modalAction?.request.userEmail || modalAction?.request.userId
                }? The user will immediately be locked out of paid videos.`
              : `Are you sure you want to permanently delete this subscription request?`
          }
          confirmLabel={
            actionLoading
              ? 'Processing...'
              : modalAction?.type === 'approve'
              ? 'Approve & Unlock'
              : modalAction?.type === 'revoke'
              ? 'Revoke Access'
              : 'Delete'
          }
          confirmVariant={modalAction?.type === 'approve' ? 'primary' : 'danger'}
          onConfirm={handleConfirmModal}
          onCancel={() => setModalAction(null)}
        />

        {/* Floating Toast */}
        {toastMessage && (
          <div className={styles.toast}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {toastMessage}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
