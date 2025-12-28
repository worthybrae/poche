"""End-to-end tests for the 3D CAD editor."""

import pytest
from playwright.sync_api import Page, expect
import time


class TestCADEditor:
    """Test suite for CAD editor functionality."""

    console_messages = []

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        """Navigate to the editor before each test."""
        # Clear console messages for each test
        TestCADEditor.console_messages = []

        # Capture console messages
        def handle_console(msg):
            TestCADEditor.console_messages.append(f"[{msg.type}] {msg.text}")
            print(f"CONSOLE: [{msg.type}] {msg.text}")

        page.on("console", handle_console)

        page.goto("http://frontend:5173")
        page.wait_for_load_state("networkidle")
        # Wait for 3D canvas to initialize
        time.sleep(2)

    def test_editor_loads(self, page: Page):
        """Test that the editor page loads correctly."""
        # Check title
        expect(page.locator("h1")).to_contain_text("Poche")

        # Check canvas exists
        canvas = page.locator("canvas")
        expect(canvas).to_be_visible()

        # Take screenshot
        page.screenshot(path="/results/01_editor_loaded.png")

    def test_toolbar_visible(self, page: Page):
        """Test that the toolbar is visible with tools."""
        # Check for toolbar buttons
        buttons = page.locator("button").all()
        assert len(buttons) > 5, "Toolbar should have multiple tool buttons"

        page.screenshot(path="/results/02_toolbar_visible.png")

    def test_line_tool_activation(self, page: Page):
        """Test that pressing L activates the line tool."""
        # Press L to activate line tool
        page.keyboard.press("l")
        time.sleep(0.5)

        # The line button should be highlighted (has bg-blue-600 class)
        # We can verify by checking if orbit controls are disabled
        page.screenshot(path="/results/03_line_tool_activated.png")

    def test_draw_line(self, page: Page):
        """Test drawing a line on the canvas."""
        # Get canvas bounds
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None, "Canvas should have a bounding box"

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        print(f"Canvas bounds: {box}")
        print(f"Center point: ({center_x}, {center_y})")

        # Check initial status
        status_bar = page.locator("[class*='StatusBar'], footer, .absolute.bottom-0").first
        print(f"Initial status bar content: {status_bar.text_content() if status_bar.is_visible() else 'not visible'}")

        # Screenshot before line tool
        page.screenshot(path="/results/04a_before_line_tool.png")

        # Activate line tool
        print("Pressing 'l' to activate line tool...")
        page.keyboard.press("l")
        time.sleep(0.5)

        # Screenshot after activating tool
        page.screenshot(path="/results/04b_line_tool_active.png")

        # Click first point
        x1, y1 = center_x - 100, center_y
        print(f"Clicking first point at ({x1}, {y1})...")
        page.mouse.click(x1, y1)
        time.sleep(0.5)

        # Screenshot after first click
        page.screenshot(path="/results/04c_after_first_click.png")
        print(f"Status after first click: {status_bar.text_content() if status_bar.is_visible() else 'not visible'}")

        # Move and click second point
        x2, y2 = center_x + 100, center_y
        print(f"Moving to ({x2}, {y2})...")
        page.mouse.move(x2, y2)
        time.sleep(0.3)

        print(f"Clicking second point at ({x2}, {y2})...")
        page.mouse.click(x2, y2)
        time.sleep(0.5)

        # Screenshot after second click
        page.screenshot(path="/results/04d_after_second_click.png")
        print(f"Status after second click: {status_bar.text_content() if status_bar.is_visible() else 'not visible'}")

        # Finish drawing
        print("Pressing Escape to finish drawing...")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # Take final screenshot
        page.screenshot(path="/results/04_line_drawn.png")

        # Print all console messages
        print("\n--- CONSOLE MESSAGES ---")
        for msg in TestCADEditor.console_messages:
            print(msg)
        print("--- END CONSOLE MESSAGES ---\n")

        # Check status bar shows vertices/edges
        final_status = page.locator("text=/\\d+ vertices/")
        print(f"Final status text: {final_status.text_content() if final_status.is_visible() else 'not visible'}")
        expect(final_status).to_be_visible()

    def test_draw_triangle(self, page: Page):
        """Test drawing a closed triangle - should create a face."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Activate line tool
        page.keyboard.press("l")
        time.sleep(0.3)

        # Draw triangle - need to close it to create a face
        points = [
            (center_x, center_y - 80),      # Top
            (center_x - 80, center_y + 60), # Bottom left
            (center_x + 80, center_y + 60), # Bottom right
            (center_x, center_y - 80),      # Back to top (close the loop)
        ]

        for i, (x, y) in enumerate(points):
            if i == 0:
                page.mouse.click(x, y)
            else:
                page.mouse.move(x, y)
                time.sleep(0.1)
                page.mouse.click(x, y)
            time.sleep(0.2)

        page.keyboard.press("Escape")
        time.sleep(0.3)

        page.screenshot(path="/results/05_triangle_drawn.png")

        # Check that a face was created
        faces_status = page.locator("text=/\\d+ faces/")
        expect(faces_status).to_be_visible()
        print(f"Faces status: {faces_status.text_content()}")

    def test_draw_rectangle_with_diagonal(self, page: Page):
        """Test that drawing a diagonal through a rectangle creates 2 faces."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Activate line tool
        page.keyboard.press("l")
        time.sleep(0.3)

        # Draw a rectangle (4 points, closing back to start)
        rect_points = [
            (center_x - 60, center_y - 40),  # Top-left (A)
            (center_x + 60, center_y - 40),  # Top-right (B)
            (center_x + 60, center_y + 40),  # Bottom-right (C)
            (center_x - 60, center_y + 40),  # Bottom-left (D)
            (center_x - 60, center_y - 40),  # Back to top-left (close)
        ]

        for i, (x, y) in enumerate(rect_points):
            if i == 0:
                page.mouse.click(x, y)
            else:
                page.mouse.move(x, y)
                time.sleep(0.1)
                page.mouse.click(x, y)
            time.sleep(0.2)

        page.keyboard.press("Escape")
        time.sleep(0.3)

        # Should have 1 face (the rectangle)
        page.screenshot(path="/results/10_rectangle_1_face.png")

        # Now draw a diagonal from A to C
        page.keyboard.press("l")
        time.sleep(0.3)

        # Click on top-left corner (A)
        page.mouse.click(center_x - 60, center_y - 40)
        time.sleep(0.3)

        # Click on bottom-right corner (C)
        page.mouse.move(center_x + 60, center_y + 40)
        time.sleep(0.1)
        page.mouse.click(center_x + 60, center_y + 40)
        time.sleep(0.3)

        page.keyboard.press("Escape")
        time.sleep(0.3)

        page.screenshot(path="/results/11_rectangle_with_diagonal.png")

        # Check that we now have 2 faces (the diagonal splits the rectangle)
        faces_status = page.locator("text=/\\d+ faces/")
        status_text = faces_status.text_content()
        print(f"Faces status after diagonal: {status_text}")

        # Should have 2 faces now
        expect(faces_status).to_contain_text("2 faces")

    def test_camera_orbit(self, page: Page):
        """Test that camera orbit works with select tool."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Make sure we're in select mode (orbit enabled)
        page.keyboard.press("v")
        time.sleep(0.3)

        # Take before screenshot
        page.screenshot(path="/results/06_before_orbit.png")

        # Drag to orbit camera
        page.mouse.move(center_x, center_y)
        page.mouse.down()
        page.mouse.move(center_x + 100, center_y - 50, steps=10)
        page.mouse.up()
        time.sleep(0.5)

        # Take after screenshot
        page.screenshot(path="/results/07_after_orbit.png")

    def test_grid_snap_toggle(self, page: Page):
        """Test that grid snap can be toggled."""
        # Find snap button and click it
        snap_button = page.locator("button:has-text('Snap')")
        expect(snap_button).to_be_visible()

        # Click to toggle
        snap_button.click()
        time.sleep(0.3)

        page.screenshot(path="/results/08_snap_toggled.png")

    def test_clear_scene(self, page: Page):
        """Test clearing the scene."""
        # First draw something
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        page.keyboard.press("l")
        time.sleep(0.2)
        page.mouse.click(center_x, center_y)
        time.sleep(0.2)
        page.mouse.click(center_x + 50, center_y)
        time.sleep(0.2)
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # Find and click clear button (trash icon)
        clear_button = page.locator("button").filter(has=page.locator("svg")).last
        clear_button.click()
        time.sleep(0.3)

        page.screenshot(path="/results/09_scene_cleared.png")

    def test_rectangle_tool(self, page: Page):
        """Test the rectangle drawing tool."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Activate rectangle tool with 'R'
        page.keyboard.press("r")
        time.sleep(0.5)

        page.screenshot(path="/results/12_rectangle_tool_active.png")

        # Click first corner - use larger Y offsets to ensure Z variation in world space
        # With isometric camera, Y screen movement translates to Z world movement
        first_x, first_y = center_x - 100, center_y - 150
        print(f"Clicking first corner at ({first_x}, {first_y})...")
        page.mouse.click(first_x, first_y)
        time.sleep(0.3)

        page.screenshot(path="/results/13_rectangle_first_corner.png")

        # Move to opposite corner for preview - larger offset to ensure non-zero Z
        second_x, second_y = center_x + 100, center_y + 150
        print(f"Moving to ({second_x}, {second_y}) for preview...")
        page.mouse.move(second_x, second_y)
        time.sleep(0.5)

        # Take screenshot of preview
        page.screenshot(path="/results/14_rectangle_preview.png")

        # Click to complete rectangle
        print(f"Clicking second corner at ({second_x}, {second_y})...")
        page.mouse.click(second_x, second_y)
        time.sleep(0.5)

        page.screenshot(path="/results/15_rectangle_complete.png")

        # Check that geometry was created (4 vertices, 4 edges, 1 face)
        vertices_status = page.locator("text=/\\d+ vertices/")
        edges_status = page.locator("text=/\\d+ edges/")
        faces_status = page.locator("text=/\\d+ faces/")

        expect(vertices_status).to_be_visible()
        expect(edges_status).to_be_visible()
        expect(faces_status).to_be_visible()

        vertices_text = vertices_status.text_content()
        edges_text = edges_status.text_content()
        faces_text = faces_status.text_content()

        print(f"Rectangle created: {vertices_text}, {edges_text}, {faces_text}")

        # Should have 4 vertices
        expect(vertices_status).to_contain_text("4 vertices")
        # Should have 4 edges
        expect(edges_status).to_contain_text("4 edges")
        # Should have 1 face
        expect(faces_status).to_contain_text("1 face")

    def test_rectangle_cancel(self, page: Page):
        """Test cancelling rectangle drawing with Escape."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Activate rectangle tool
        page.keyboard.press("r")
        time.sleep(0.3)

        # Click first corner
        page.mouse.click(center_x - 50, center_y - 30)
        time.sleep(0.3)

        # Move to show preview
        page.mouse.move(center_x + 50, center_y + 30)
        time.sleep(0.3)

        page.screenshot(path="/results/16_rectangle_before_cancel.png")

        # Press Escape to cancel
        page.keyboard.press("Escape")
        time.sleep(0.3)

        page.screenshot(path="/results/17_rectangle_after_cancel.png")

        # Check that no geometry was created
        vertices_status = page.locator("text=/\\d+ vertices/")
        vertices_text = vertices_status.text_content()
        print(f"Vertices after cancel: {vertices_text}")

        # Should have 0 vertices
        expect(vertices_status).to_contain_text("0 vertices")

    def test_circle_tool(self, page: Page):
        """Test the circle drawing tool."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Activate circle tool with 'C'
        page.keyboard.press("c")
        time.sleep(0.5)

        page.screenshot(path="/results/18_circle_tool_active.png")

        # Click to place center
        print(f"Clicking center at ({center_x}, {center_y})...")
        page.mouse.click(center_x, center_y)
        time.sleep(0.3)

        page.screenshot(path="/results/19_circle_center.png")

        # Move to set radius (100 pixels away)
        radius_x, radius_y = center_x + 100, center_y
        print(f"Moving to ({radius_x}, {radius_y}) to set radius...")
        page.mouse.move(radius_x, radius_y)
        time.sleep(0.5)

        # Take screenshot of preview
        page.screenshot(path="/results/20_circle_preview.png")

        # Click to complete circle
        print(f"Clicking to complete circle...")
        page.mouse.click(radius_x, radius_y)
        time.sleep(0.5)

        page.screenshot(path="/results/21_circle_complete.png")

        # Check that geometry was created (24 vertices, 24 edges, 1 face)
        vertices_status = page.locator("text=/\\d+ vertices/")
        edges_status = page.locator("text=/\\d+ edges/")
        faces_status = page.locator("text=/\\d+ faces/")

        expect(vertices_status).to_be_visible()
        expect(edges_status).to_be_visible()
        expect(faces_status).to_be_visible()

        vertices_text = vertices_status.text_content()
        edges_text = edges_status.text_content()
        faces_text = faces_status.text_content()

        print(f"Circle created: {vertices_text}, {edges_text}, {faces_text}")

        # Should have 24 vertices (polygon approximation)
        expect(vertices_status).to_contain_text("24 vertices")
        # Should have 24 edges
        expect(edges_status).to_contain_text("24 edges")
        # Should have 1 face
        expect(faces_status).to_contain_text("1 face")

    def test_vertical_wall_rectangle(self, page: Page):
        """Test drawing a vertical wall with the rectangle tool."""
        canvas = page.locator("canvas").first
        box = canvas.bounding_box()
        assert box is not None

        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Activate rectangle tool with 'R'
        page.keyboard.press("r")
        time.sleep(0.5)

        # Click to place first corner at ground level
        first_x, first_y = center_x - 100, center_y + 50
        print(f"Clicking first corner at ({first_x}, {first_y})...")
        page.mouse.click(first_x, first_y)
        time.sleep(0.3)

        page.screenshot(path="/results/22_wall_first_corner.png")

        # Move UP on screen (negative Y) to create height, and right for width
        # This should create a vertical wall
        second_x, second_y = center_x + 100, center_y - 150  # Move up significantly
        print(f"Moving to ({second_x}, {second_y}) for vertical wall...")
        page.mouse.move(second_x, second_y)
        time.sleep(0.5)

        # Take screenshot of preview
        page.screenshot(path="/results/23_wall_preview.png")

        # Click to complete wall
        print(f"Clicking to complete wall...")
        page.mouse.click(second_x, second_y)
        time.sleep(0.5)

        page.screenshot(path="/results/24_wall_complete.png")

        # Check that geometry was created
        vertices_status = page.locator("text=/\\d+ vertices/")
        edges_status = page.locator("text=/\\d+ edges/")
        faces_status = page.locator("text=/\\d+ faces/")

        expect(vertices_status).to_be_visible()
        expect(edges_status).to_be_visible()
        expect(faces_status).to_be_visible()

        vertices_text = vertices_status.text_content()
        edges_text = edges_status.text_content()
        faces_text = faces_status.text_content()

        print(f"Wall created: {vertices_text}, {edges_text}, {faces_text}")

        # Should have 4 vertices
        expect(vertices_status).to_contain_text("4 vertices")
        # Should have 4 edges
        expect(edges_status).to_contain_text("4 edges")
        # Should have 1 face
        expect(faces_status).to_contain_text("1 face")
