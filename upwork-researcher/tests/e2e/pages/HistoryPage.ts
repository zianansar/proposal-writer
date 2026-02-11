/**
 * Page Object Model for History View
 *
 * Represents the proposal history list (Story 1.4)
 * Shows past proposals with:
 * - Preview text
 * - Job title
 * - Creation date
 * - Actions (view, delete)
 */

import { Page, Locator, expect } from '@playwright/test';

export class HistoryPage {
  readonly page: Page;

  // Navigation
  readonly historyNav: Locator;
  readonly backToEditorButton: Locator;

  // List view
  readonly proposalList: Locator;
  readonly proposalItems: Locator;

  // Virtualized list (react-window)
  readonly virtualizedList: Locator;

  // Empty state
  readonly emptyState: Locator;

  // Search/Filter (if implemented)
  readonly searchInput: Locator;
  readonly filterButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.historyNav = page.getByTestId('history-nav');
    this.backToEditorButton = page.getByRole('button', { name: /back|editor/i });

    // List
    this.proposalList = page.getByTestId('history-list');
    this.proposalItems = page.getByTestId(/history-item-/);
    this.virtualizedList = page.locator('[data-testid^="history-list"]');

    // Empty state
    this.emptyState = page.getByText(/no proposals yet/i);

    // Search/Filter
    this.searchInput = page.getByRole('textbox', { name: /search/i });
    this.filterButton = page.getByRole('button', { name: /filter/i });
  }

  /**
   * Navigate to history view
   */
  async navigateToHistory(): Promise<void> {
    await this.historyNav.click();
    await expect(this.proposalList).toBeVisible();
  }

  /**
   * Get count of proposals in history
   */
  async getProposalCount(): Promise<number> {
    // Wait for list to load with explicit condition
    await expect(this.proposalList).toBeVisible();
    // Wait for at least one item or empty state
    await this.page.waitForSelector(
      '[data-testid^="history-item-"], [data-testid="empty-state"]',
      { state: 'visible', timeout: 5000 }
    );

    const items = await this.proposalItems.count();
    return items;
  }

  /**
   * Get proposal item by index (0-based)
   */
  getProposalItem(index: number): Locator {
    return this.page.getByTestId(`history-item-${index}`);
  }

  /**
   * Click on a proposal to view details
   */
  async viewProposal(index: number): Promise<void> {
    const item = this.getProposalItem(index);
    await item.click();
  }

  /**
   * Delete a proposal
   */
  async deleteProposal(index: number): Promise<void> {
    const item = this.getProposalItem(index);
    const deleteButton = item.getByRole('button', { name: /delete/i });
    await deleteButton.click();

    // Wait for confirmation dialog and confirm
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /**
   * Get proposal details from list item
   */
  async getProposalDetails(index: number): Promise<{
    preview: string;
    jobTitle: string;
    date: string;
  }> {
    const item = this.getProposalItem(index);

    const preview = (await item.getByTestId('proposal-preview').textContent()) ?? '';
    const jobTitle = (await item.getByTestId('job-title').textContent()) ?? '';
    const date = (await item.getByTestId('proposal-date').textContent()) ?? '';

    return { preview, jobTitle, date };
  }

  /**
   * Search proposals
   * M3 FIX: Uses explicit element-based wait instead of unreliable networkidle
   */
  async searchProposals(query: string): Promise<void> {
    await this.searchInput.fill(query);
    // Wait for list to re-render with filtered results or empty state
    await this.page.waitForSelector(
      '[data-testid^="history-item-"], [data-testid="empty-state"], [data-testid="no-results"]',
      { state: 'visible', timeout: 5000 }
    );
  }

  /**
   * Go back to editor
   */
  async returnToEditor(): Promise<void> {
    await this.backToEditorButton.click();
  }

  /**
   * Scroll virtualized list to bottom
   * Useful for testing large lists
   */
  async scrollToBottom(): Promise<void> {
    await this.virtualizedList.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }
}
