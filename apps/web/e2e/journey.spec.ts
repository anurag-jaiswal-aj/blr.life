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
              component_scores: {
                metro: 0,
                work_distance: 90,
                cafe: 80,
                restaurant: 85,
                park: 75,
                healthcare: 90,
                nightlife: 70
              },
              raw_metrics: {
                metro_distance_m: null,
                work_distance_km: 2.5,
                cafe_accessibility: 80,
                restaurant_accessibility: 85,
                park_accessibility: 75,
                healthcare_accessibility: 90,
                nightlife_accessibility: 70
              },
              metadata: {
                coordinates: {
                  lat: 12.9121,
                  lng: 77.6446
                }
              },
              explanations: {
                pros: ['Very close to work (2.5 km)'],
                warnings: ['No metro station nearby']
              }
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
    // The UI should display the selected location name as a badge
    const badge = page.getByTitle('Koramangala, Bengaluru, India');
    await expect(badge).toBeVisible();

    // The URL should be updated with coordinates
    await expect(page).toHaveURL(/lat=12.9352/);
    await expect(page).toHaveURL(/lng=77.6245/);

    // Step 8: Adjust meaningful recommendation constraint/control
    const maxRentInput = page.getByRole('spinbutton', { name: /Max Rent Budget/i });
    await expect(maxRentInput).toBeVisible();
    await maxRentInput.fill('25000');
    // Blur to ensure the update State fires (it triggers on onChange though, but blur is safe)
    await maxRentInput.blur();

    const propertyTypeSelect = page.getByRole('combobox', { name: /Property Type/i });
    await propertyTypeSelect.selectOption('1bhk');

    // Step 9 & 10: Allow the recommendation request to execute & Verify recommendation results render
    // SWR will fetch automatically due to state change
    const resultTitle = page.getByRole('heading', { name: /HSR Layout \(Mock\)/i });
    await expect(resultTitle).toBeVisible();

    // Step 11: Verify at least one meaningful piece of recommendation information is visible
    // Verify the pro text is visible
    await expect(page.getByText('Very close to work (2.5 km)')).toBeVisible();
    
    // Verify the URL was updated with our constraints
    await expect(page).toHaveURL(/max_budget=25000/);
    await expect(page).toHaveURL(/bhk=1bhk/);
  });
});
