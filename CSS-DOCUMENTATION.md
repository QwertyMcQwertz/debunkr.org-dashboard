# CSS Documentation - Misinformation Manager

## Overview

The extension uses a professional, clean design system with a focus on readability and user experience. The CSS is organized into logical sections with consistent naming conventions and responsive design principles.

## Design System

### Color Palette
- **Primary Dark**: `#202C39` - Main brand color, buttons, accents
- **Gray Base**: `#847E89` - Foundation for gray scale, primary text
- **Secondary Dark**: `#1e293b` - Hover states, active elements
- **Background Light**: `#f8fafc` - Main background, cards
- **Background White**: `#ffffff` - Content areas, modals
- **Text Primary**: `#334155` - Main text content
- **Text Secondary**: `#64748b` - Subdued text, placeholders
- **Text Muted**: `#94a3b8` - Meta information, timestamps
- **Border Light**: `#e2e8f0` - Subtle borders, dividers
- **Border Medium**: `#cbd5e1` - Input borders, cards
- **Success**: `#10b981` - Success states, confirmations
- **Error**: `#dc2626` - Error states, warnings

### Typography
- **Font Family**: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif
- **Base Size**: 14px with 1.5 line height
- **Monospace**: 'Monaco', 'Menlo', 'Ubuntu Mono' for API keys

## Layout Structure

### `.app-container`
Main application wrapper using flexbox layout
- `display: flex` - Horizontal layout
- `height: 100vh` - Full viewport height
- Creates sidebar + main content layout

### `.sidebar`
Left navigation panel
- `width: 280px` - Fixed width
- `background: #f8fafc` - Light background
- `border-right: 1px solid #e2e8f0` - Subtle separator
- `box-shadow: 1px 0 3px rgba(0, 0, 0, 0.05)` - Depth

### `.main-content`
Right content area
- `flex: 1` - Takes remaining space
- `display: flex; flex-direction: column` - Vertical layout
- `background: white` - Clean background

## Component Styles

### Sidebar Components

#### `.sidebar-header`
Top section with logo and new chat button
- `padding: 24px 20px` - Generous padding
- `border-bottom: 1px solid #e2e8f0` - Visual separation
- `background: #ffffff` - Elevated appearance

#### `.logo`
Extension branding
- `display: flex; align-items: center` - Horizontal alignment
- `font-size: 16px; font-weight: 600` - Prominent but not overwhelming
- `color: #202C39` - Brand color

#### `.logo-icon`
Icon next to logo text
- `width: 28px; height: 28px` - Compact square
- `border-radius: 6px` - Subtle rounding
- `background: #202C39; color: white` - High contrast

#### `.new-chat-btn`
Primary action button
- `background: #202C39; color: white` - Brand colors
- `border-radius: 6px` - Consistent rounding
- `padding: 12px 16px` - Comfortable touch target
- `transition: all 0.15s ease` - Smooth interactions
- **Hover**: `background: #1e293b` - Darker shade

#### `.search-container` & `.search-input`
Chat search functionality
- `background: #f1f5f9` - Subtle background
- `border: 1px solid #cbd5e1` - Light border
- `border-radius: 6px` - Consistent rounding
- **Focus**: `border-color: #202C39; background: #ffffff` - Active state

#### `.chat-item`
Individual chat in sidebar
- `padding: 14px 12px` - Comfortable spacing
- `border-radius: 6px` - Subtle rounding
- `transition: all 0.15s ease` - Smooth hover
- **Hover**: `background: #f1f5f9; border-color: #e2e8f0` - Gentle highlight
- **Active**: `background: #202C39; color: white` - Clear selection

#### `.chat-actions`
Hover actions for chat items
- `opacity: 0` - Hidden by default
- `transition: opacity 0.2s ease` - Smooth reveal
- **Parent hover**: `opacity: 1` - Shows on chat item hover

### Main Content Components

#### `.chat-header`
Top area with title and source info
- `padding: 16px 32px` - Generous horizontal padding
- `border-bottom: 1px solid #e5e7eb` - Subtle separation
- `background: #f9fafb` - Slightly elevated

#### `.chat-title-editable`
Inline editable chat title
- `background: transparent` - Invisible until interaction
- `border: 1px solid transparent` - Seamless appearance
- `text-align: center` - Centered presentation
- **Hover**: `background: rgba(15, 23, 42, 0.05)` - Subtle highlight
- **Focus**: `background: white; border-color: #202C39` - Clear edit mode

#### `.messages-container`
Scrollable message area
- `flex: 1` - Takes available space
- `overflow-y: auto` - Vertical scrolling
- `padding: 32px` - Generous padding for readability

### Message Styles

#### `.message`
Individual message wrapper
- `margin-bottom: 24px` - Spacing between messages
- `display: flex; gap: 12px` - Avatar + content layout
- **User messages**: `flex-direction: row-reverse` - Right alignment

#### `.message-avatar`
User/AI avatar circles
- `width: 32px; height: 32px` - Consistent size
- `border-radius: 50%` - Perfect circle
- `display: flex; align-items: center; justify-content: center` - Centered text
- **User**: `background: #202C39; color: white` - Brand colors
- **Assistant**: `background: #e2e8f0; color: #202C39` - Inverted colors

#### `.message-content`
Message text bubble
- `max-width: 70%` - Prevents overly wide messages
- `background: #f8fafc` - Light background for assistant
- `padding: 14px 18px` - Comfortable padding
- `border-radius: 12px` - Rounded bubble appearance
- **User messages**: `background: #202C39; color: white` - Inverted styling

#### `.copy-message-btn`
Copy button for messages
- `background: rgba(255, 255, 255, 0.95)` - Semi-transparent
- `border: 1px solid #e2e8f0` - Subtle border
- `border-radius: 12px` - Rounded appearance
- `padding: 2px 6px` - Compact but touchable
- **Hover**: `background: #202C39; color: white` - Brand color transformation

### Quote Block Styles

#### `.quote-block`
Styled quotes in messages
- `background: #f8fafc` - Light background
- `border-left: 4px solid #202C39` - Brand accent border
- `margin: 12px 0` - Vertical spacing
- `padding: 16px 20px` - Comfortable padding
- `border-radius: 0 8px 8px 0` - Right-side rounding
- `font-style: italic` - Distinguishes from regular text
- `position: relative` - For pseudo-element positioning

#### Quote Decorations
Large quotation marks using pseudo-elements
- `::before` and `::after` - Decorative quote marks
- `font-size: 20px; opacity: 0.3` - Subtle appearance
- Positioned at top-left and bottom-right

#### `.input-quote-block`
Quote preview in input area
- `background: #f1f5f9` - Distinct from message quotes
- `border-left: 3px solid #64748b` - Thinner accent
- `max-height: 150px; overflow-y: auto` - Scrollable for long quotes
- `position: relative` - For remove button positioning

#### `.input-quote-remove`
Remove button for input quotes
- `position: absolute; top: 4px; right: 4px` - Corner placement
- `background: rgba(255, 255, 255, 0.9)` - Semi-transparent
- `border-radius: 50%` - Circular button
- `width: 20px; height: 20px` - Compact size

### Input Area Styles

#### `.input-container`
Bottom message input area
- `padding: 20px 32px 24px` - Generous padding
- `border-top: 1px solid #e5e7eb` - Top separator
- `background: white` - Clean background

#### `.input-wrapper`
Input field container
- `max-width: 800px; margin: 0 auto` - Centered with max width
- `border: 1px solid #d1d5db` - Subtle border
- `border-radius: 8px` - Rounded corners
- `display: flex; align-items: flex-end` - Textarea + button layout
- **Focus-within**: `border-color: #202C39` - Active state

#### `#messageInput`
Main text input area
- `flex: 1` - Takes available space
- `border: none; outline: none` - Clean appearance
- `padding: 12px 16px` - Comfortable padding
- `max-height: 120px` - Prevents excessive growth
- `resize: none` - JavaScript-controlled sizing

#### `.send-button`
Message send button
- `background: #202C39; color: white` - Brand colors
- `width: 36px; height: 36px` - Square button
- `border-radius: 6px` - Subtle rounding
- `display: flex; align-items: center; justify-content: center` - Centered icon
- **Disabled**: `background: #d1d5db` - Muted appearance

### Modal Styles

#### `.modal-overlay`
Full-screen modal backdrop
- `position: fixed; top: 0; left: 0; right: 0; bottom: 0` - Full coverage
- `background: rgba(0, 0, 0, 0.5)` - Semi-transparent backdrop
- `backdrop-filter: blur(4px)` - Modern blur effect
- `z-index: 1000` - Ensures top layer

#### `.modal-content`
Modal dialog box
- `background: white` - Clean background
- `border-radius: 12px` - Rounded corners
- `min-width: 400px; max-width: 500px` - Responsive sizing
- `box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1)` - Elevated appearance

#### `.modal-header`
Modal title area
- `display: flex; justify-content: space-between` - Title + close button
- `padding: 24px 24px 16px 24px` - Asymmetric padding
- `border-bottom: 1px solid #e2e8f0` - Visual separation

### Form Styles

#### `.api-key-input`
API key input field
- `font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace` - Monospace font
- `padding: 12px 16px; padding-right: 48px` - Space for toggle button
- `border: 1px solid #d1d5db` - Standard input styling
- **Focus**: `border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1)` - Blue focus ring

#### `.toggle-key-btn`
Show/hide password toggle
- `position: absolute; right: 12px` - Inside input field
- `background: none; border: none` - Transparent button
- **Hover**: `background: #f3f4f6` - Subtle highlight

### Status Styles

#### `.settings-status`
Status messages in settings
- `padding: 12px; border-radius: 8px` - Card-like appearance
- `text-align: center` - Centered text
- `display: none` - Hidden by default

#### Status Variants
- **Success**: `background: #dcfce7; color: #166534; border: 1px solid #bbf7d0`
- **Error**: `background: #fef2f2; color: #dc2626; border: 1px solid #fecaca`
- **Loading**: `background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe`

### Utility Classes

#### `.no-results`
Empty state messaging
- `padding: 20px 16px; text-align: center` - Centered padding
- `color: #9ca3af; font-style: italic` - Muted, italicized text

#### `.loading-dots`
Loading animation
- `position: relative` - For pseudo-element positioning
- `::after` - Animated dots using CSS animation
- `animation: loading-dots 1.5s infinite linear` - Smooth animation

### Responsive Design

#### Scrollbar Styling
Custom scrollbars for better aesthetics
- `width: 6px` - Thin scrollbars
- Sidebar: `background: #4b5563` - Darker for contrast
- Main content: `background: #d1d5db` - Lighter, subtle

#### Hover States
Consistent 0.15s transitions throughout
- Buttons use `transform: translateY(-1px)` for lift effect
- Colors transition smoothly between states
- Box shadows enhance depth on hover

## Animation System

### Transitions
- **Standard**: `transition: all 0.15s ease` - Quick, responsive
- **Longer**: `transition: all 0.2s ease` - For more complex state changes
- **Opacity**: `transition: opacity 0.2s ease` - For show/hide effects

### Transforms
- **Hover lift**: `transform: translateY(-1px)` - Subtle elevation
- **Loading animation**: `transform: translateX()` - Horizontal movement
- **Scale effects**: Used sparingly for emphasis

## Accessibility Features

### Focus Management
- Clear focus rings using box-shadow
- Keyboard navigation support
- Logical tab order throughout interface

### Color Contrast
- All text meets WCAG AA contrast requirements
- Interactive elements have sufficient contrast
- Status colors chosen for accessibility

### Screen Reader Support
- Semantic HTML structure
- Proper heading hierarchy
- Meaningful alt text and labels

This CSS architecture provides a cohesive, professional appearance while maintaining excellent usability and accessibility standards.