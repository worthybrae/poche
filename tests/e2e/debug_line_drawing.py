"""
Debug script to test line drawing with console log capture.
"""

from playwright.sync_api import sync_playwright
import time

def main():
    console_messages = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console messages
        page.on('console', lambda msg: console_messages.append(f'[{msg.type}] {msg.text}'))

        print("Navigating to http://localhost:5173...")
        page.goto('http://localhost:5173')
        page.wait_for_load_state('networkidle')
        time.sleep(2)  # Wait for React to fully render

        # Screenshot 1: Initial state
        page.screenshot(path='/tmp/debug_01_initial.png', full_page=True)
        print("Screenshot 1: Initial state saved")

        # Check initial state from status bar
        status = page.locator('text=/\\d+ vertices, \\d+ edges/').first
        if status.is_visible():
            print(f"Initial status: {status.text_content()}")

        # Press 'L' to activate line tool
        print("\nPressing 'L' to activate line tool...")
        page.keyboard.press('l')
        time.sleep(0.5)

        # Screenshot 2: After pressing L
        page.screenshot(path='/tmp/debug_02_after_L.png', full_page=True)
        print("Screenshot 2: After pressing L saved")

        # Get canvas element
        canvas = page.locator('canvas').first
        canvas_box = canvas.bounding_box()
        print(f"Canvas bounding box: {canvas_box}")

        if canvas_box:
            center_x = canvas_box['x'] + canvas_box['width'] / 2
            center_y = canvas_box['y'] + canvas_box['height'] / 2

            # Click 1: First point
            print(f"\nClicking at ({center_x}, {center_y}) for first point...")
            page.mouse.click(center_x, center_y)
            time.sleep(0.5)

            # Screenshot 3: After first click
            page.screenshot(path='/tmp/debug_03_after_click1.png', full_page=True)
            print("Screenshot 3: After first click saved")

            # Click 2: Second point (offset)
            x2 = center_x + 100
            y2 = center_y
            print(f"Clicking at ({x2}, {y2}) for second point...")
            page.mouse.click(x2, y2)
            time.sleep(0.5)

            # Screenshot 4: After second click
            page.screenshot(path='/tmp/debug_04_after_click2.png', full_page=True)
            print("Screenshot 4: After second click saved")

            # Check status bar again
            if status.is_visible():
                print(f"Final status: {status.text_content()}")

        # Print console messages
        print("\n" + "="*50)
        print("CONSOLE MESSAGES:")
        print("="*50)
        for msg in console_messages:
            print(msg)

        browser.close()
        print("\nDone! Check /tmp/debug_*.png for screenshots")

if __name__ == '__main__':
    main()
