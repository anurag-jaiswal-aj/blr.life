import { test, expect } from '@playwright/test';

test.describe('V1 Critical User Journey', () => {
  test('Search work location, adjust controls, and view recommendations', async ({ page }) => {
    // 1. Mock the geocoding API to prevent live Nominatim calls and ensure determinism.
    await page.route('**/api/geocode*', async route => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');
      
      if (query?.toLowerCase() === 'koramangala') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                place_id: 1,
                lat: 12.9352,
                lng: 77.6245,
                display_name: 'Koramangala, Bengaluru, India',
                name: 'Koramangala'
              }
            ]
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] })
        });
      }
    });

    // 2. Mock the recommendation API to prevent backend dependency and ensure determinism.
    await page.route('**/api/v1/recommend', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          recommendations: [
              {
                locality_id: 101,
                slug: 'hsr-layout',
                name: 'HSR Layout (Mock)',
                rank: 1,
                total_score: 85,
                component_scores: { metro: 0, work_distance: 0.9, cafe: 0.8, restaurant: 0.85, park: 0.75, healthcare: 0.9, nightlife: 0.7 },
                raw_metrics: { metro_distance_m: null, work_distance_km: 2.5, cafe_accessibility: 80, restaurant_accessibility: 85, park_accessibility: 75, healthcare_accessibility: 90, nightlife_accessibility: 70 },
                metadata: { coordinates: { lat: 12.9121, lng: 77.6446 } },
                explanations: { pros: ['Close to work', 'High restaurant count within 1.5km'], warnings: ['Metro proximity data unavailable'] }
              },
              {
                locality_id: 102,
                slug: 'btm-layout',
                name: 'BTM Layout (Mock)',
                rank: 2,
                total_score: 80,
                component_scores: { metro: 0, work_distance: 0.85, cafe: 0.75, restaurant: 0.8, park: 0.7, healthcare: 0.85, nightlife: 0.65 },
                raw_metrics: { metro_distance_m: null, work_distance_km: 3.5, cafe_accessibility: 75, restaurant_accessibility: 80, park_accessibility: 70, healthcare_accessibility: 85, nightlife_accessibility: 65 },
                metadata: { coordinates: { lat: 12.9166, lng: 77.6101 } },
                explanations: { pros: ['Close to work'], warnings: ['Metro proximity data unavailable'] }
              }
            ],
            provenance: {
              calc_versions_used: ['v1']
            }
          })
        });
      });
  
      // Step 1: Open blr.life — first-visit empty state
      await page.goto('/');
  
      // Step 2: Verify first-visit state
      await expect(page.getByText(/Find neighbourhoods around your workplace/i)).toBeVisible();

      // Step 3: Search for a work location
      const searchInput = page.getByPlaceholder(/e\.g\. Koramangala/i);
      await expect(searchInput).toBeVisible();
      await searchInput.fill('Koramangala');
      await page.getByRole('button', { name: /Search/i }).click();
  
      // Step 4: Select a location result
      const option = page.getByRole('option').first();
      await expect(option).toBeVisible();
      await option.click();
  
      // Step 5: URL should update with coordinates — workspace appears
      await expect(page).toHaveURL(/lat=12.9352/);
      await expect(page).toHaveURL(/lng=77.6245/);

      // Step 6: Workspace should display results
      const resultTitle = page.getByRole('heading', { name: /HSR Layout \(Mock\)/i }).first();
      await expect(resultTitle).toBeVisible();

      // Step 7: Verify at least one meaningful piece of recommendation information is visible
      await expect(page.getByText('LIFESTYLE AROUND YOU').first()).toBeVisible();

      // Step 8: Verify selection behavior
      const firstCard = page.locator('#rec-card-101');
      await expect(firstCard).toHaveAttribute('aria-pressed', 'true');

      // Select the second card
      const secondCard = page.locator('#rec-card-102');
      await secondCard.click();
      
      await expect(secondCard).toHaveAttribute('aria-pressed', 'true');
      await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

      // Step 9: Verify the map marker for rank 2 scales up
      const secondMarker = page.locator('.maplibregl-marker div', { hasText: /^2$/ });
      await expect(secondMarker).toHaveClass(/scale-110/);

      // Step 10: Verify Shareable URL
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      const shareButton = page.getByRole('button', { name: /Share results/i });
      await shareButton.click();
      
      await expect(shareButton).toHaveText(/Copied/i);
      
      const clipboardText = await page.evaluate<string>('navigator.clipboard.readText()');
      expect(clipboardText).toContain('lat=12.9352');
      
      // Step 11: Navigate/open using that URL and verify state restoration
      await page.goto(clipboardText);
      await expect(page).toHaveURL(clipboardText);
      
      // The workspace should be directly visible (lat/lng in URL = workspace mode)
      await expect(page.getByText(/results/i).first()).toBeVisible();
    });
  });
