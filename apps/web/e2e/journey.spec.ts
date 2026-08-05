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
                component_scores: { metro: 0, work_distance: 90, cafe: 80, restaurant: 85, park: 75, healthcare: 90, nightlife: 70 },
                raw_metrics: { metro_distance_m: null, work_distance_km: 2.5, cafe_accessibility: 80, restaurant_accessibility: 85, park_accessibility: 75, healthcare_accessibility: 90, nightlife_accessibility: 70 },
                metadata: { coordinates: { lat: 12.9121, lng: 77.6446 } },
                explanations: { pros: ['Very close to work (2.5 km)'], warnings: ['No metro station nearby'] }
              },
              {
                locality_id: 102,
                slug: 'btm-layout',
                name: 'BTM Layout (Mock)',
                rank: 2,
                total_score: 80,
                component_scores: { metro: 0, work_distance: 85, cafe: 75, restaurant: 80, park: 70, healthcare: 85, nightlife: 65 },
                raw_metrics: { metro_distance_m: null, work_distance_km: 3.5, cafe_accessibility: 75, restaurant_accessibility: 80, park_accessibility: 70, healthcare_accessibility: 85, nightlife_accessibility: 65 },
                metadata: { coordinates: { lat: 12.9166, lng: 77.6101 } },
                explanations: { pros: ['Good for work (3.5 km)'], warnings: ['No metro station nearby'] }
              }
            ],
            provenance: {
              calc_versions_used: ['v1']
            }
          })
        });
      });
  
      // Step 1: Open blr.life
      await page.goto('/');
  
      // Step 2: Verify the initial work-location state is displayed
      const searchInput = page.getByRole('combobox', { name: /Search for a work location/i });
      await expect(searchInput).toBeVisible();
  
      // Step 3: Enter/search for a work location through the actual UI
      await searchInput.fill('Koramangala');
      await page.getByRole('button', { name: /Search/i }).click();
  
      // Step 4: Select a location result
      const option = page.getByRole('option', { name: /Koramangala, Bengaluru, India/i });
      await expect(option).toBeVisible();
      await option.click();
  
      // Step 6 & 7: Verify the selected location becomes canonical application state / map updates
      const badge = page.getByTitle('Koramangala, Bengaluru, India');
      await expect(badge).toBeVisible();
  
      await expect(page).toHaveURL(/lat=12.9352/);
      await expect(page).toHaveURL(/lng=77.6245/);
  
      // Step 8: Adjust meaningful recommendation constraint/control
      const maxRentInput = page.getByRole('spinbutton', { name: /Max Rent Budget/i });
      await expect(maxRentInput).toBeVisible();
      await maxRentInput.fill('25000');
      await maxRentInput.blur();
      
      await page.waitForURL(/max_budget=25000/);
  
      const propertyTypeSelect = page.getByRole('combobox', { name: /Property Type/i });
      await propertyTypeSelect.selectOption('1bhk');
  
      // Step 9 & 10: Allow the recommendation request to execute & Verify recommendation results render
      const resultTitle = page.getByRole('heading', { name: /HSR Layout \(Mock\)/i });
      await expect(resultTitle).toBeVisible();
  
      // Step 11: Verify at least one meaningful piece of recommendation information is visible
      await expect(page.getByText('Very close to work (2.5 km)')).toBeVisible();
      
      await expect(page).toHaveURL(/max_budget=25000/);
      await expect(page).toHaveURL(/bhk=1bhk/);

      // Step 12: Verify selection behavior
      // Top result should be selected by default
      const firstCard = page.locator('#rec-card-101');
      await expect(firstCard).toHaveAttribute('aria-pressed', 'true');

      // Select the second card
      const secondCard = page.locator('#rec-card-102');
      await secondCard.click();
      
      // Verify selection state moves to second card
      await expect(secondCard).toHaveAttribute('aria-pressed', 'true');
      await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

      // Verify the map marker for rank 2 scales up
      const secondMarker = page.locator('.maplibregl-marker div', { hasText: /^2$/ });
      await expect(secondMarker).toHaveClass(/scale-110/);
    });
  });
