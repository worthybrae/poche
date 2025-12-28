#!/usr/bin/env python3
"""
Manual test script for the CAD editor.
Tests the new hold-to-activate tools and keyboard shortcuts.
"""

from playwright.sync_api import sync_playwright
import time

def test_cad_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to editor...")
        page.goto('http://localhost:5173')
        page.wait_for_load_state('networkidle')

        # Wait for canvas to be ready
        page.wait_for_selector('canvas', timeout=10000)
        time.sleep(1)  # Give WebGL time to initialize

        # Get canvas bounds
        canvas = page.query_selector('canvas')
        box = canvas.bounding_box()
        center_x = box['x'] + box['width'] / 2
        center_y = box['y'] + box['height'] / 2

        print("Testing hold-to-activate line tool (A key)...")
        # Hold A key to activate line tool
        page.keyboard.down('a')
        time.sleep(0.2)

        # Click to place first point
        page.mouse.click(center_x - 100, center_y)
        time.sleep(0.2)

        # Click to place second point
        page.mouse.click(center_x + 100, center_y)
        time.sleep(0.2)

        # Release A key - should return to select
        page.keyboard.up('a')
        time.sleep(0.2)

        # Check geometry count
        stats = page.locator('text=/\\d+ vertices/').inner_text()
        vertices_match = stats.split()[0]
        print(f"After line: {stats}")

        print("Testing rectangle tool (S key)...")
        # Hold S key to activate rectangle tool
        page.keyboard.down('s')
        time.sleep(0.2)

        # Click first corner
        page.mouse.click(center_x - 50, center_y + 50)
        time.sleep(0.3)

        # Click opposite corner
        page.mouse.click(center_x + 50, center_y + 100)
        time.sleep(0.2)

        # Release S key
        page.keyboard.up('s')
        time.sleep(0.2)

        stats = page.locator('text=/\\d+ vertices/').inner_text()
        print(f"After rectangle: {stats}")

        print("Testing undo (Cmd+Z)...")
        page.keyboard.press('Meta+z')
        time.sleep(0.2)

        stats = page.locator('text=/\\d+ vertices/').inner_text()
        print(f"After undo: {stats}")

        print("Testing redo (Cmd+X)...")
        page.keyboard.press('Meta+x')
        time.sleep(0.2)

        stats = page.locator('text=/\\d+ vertices/').inner_text()
        print(f"After redo: {stats}")

        print("Testing clear scene (Shift+C)...")
        page.keyboard.press('Shift+c')
        time.sleep(0.2)

        stats = page.locator('text=/\\d+ vertices/').inner_text()
        print(f"After clear: {stats}")

        print("Testing circle tool (D key)...")
        page.keyboard.down('d')
        time.sleep(0.2)

        # Click center
        page.mouse.click(center_x, center_y)
        time.sleep(0.3)

        # Click to set radius
        page.mouse.click(center_x + 80, center_y)
        time.sleep(0.2)

        page.keyboard.up('d')
        time.sleep(0.2)

        stats = page.locator('text=/\\d+ vertices/').inner_text()
        print(f"After circle: {stats}")

        # Take final screenshot
        page.screenshot(path='/Users/worthy/TestCode/FunCode/poche/tests/results/final_test.png')
        print("Screenshot saved to tests/results/final_test.png")

        print("\n✓ All tests completed!")
        browser.close()

if __name__ == '__main__':
    test_cad_editor()
