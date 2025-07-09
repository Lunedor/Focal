// js/dropdownPositioning.js
// Smart dropdown positioning utility for mobile and desktop
// Prevents dropdowns from appearing outside visible area

const DropdownPositioning = (() => {
    
    /**
     * Calculates the best position for a dropdown to prevent it from going off-screen
     * @param {HTMLElement} anchorElement - The element that triggered the dropdown
     * @param {HTMLElement} dropdown - The dropdown element to position
     * @param {Object} options - Configuration options
     * @param {number} options.offsetX - Horizontal offset from anchor (default: -40)
     * @param {number} options.offsetY - Vertical offset from anchor (default: 0)
     * @param {number} options.margin - Margin from viewport edges (default: 10)
     * @param {boolean} options.preferBelow - Prefer positioning below anchor (default: true)
     * @param {boolean} options.preferRight - Prefer positioning to the right of anchor (default: true)
     * @returns {Object} Position object with top, left, and additional classes
     */
    function calculatePosition(anchorElement, dropdown, options = {}) {
        const {
            offsetX = -40,
            offsetY = 0,
            margin = 10,
            preferBelow = true,
            preferRight = true
        } = options;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // Get anchor element dimensions and position
        const anchorRect = anchorElement.getBoundingClientRect();
        const anchorTop = anchorRect.top + scrollY;
        const anchorLeft = anchorRect.left + scrollX;
        const anchorWidth = anchorRect.width;
        const anchorHeight = anchorRect.height;
        
        // Get dropdown dimensions (temporarily show to measure)
        const wasVisible = dropdown.style.display !== 'none';
        const originalPosition = dropdown.style.position;
        const originalTop = dropdown.style.top;
        const originalLeft = dropdown.style.left;
        
        dropdown.style.position = 'absolute';
        dropdown.style.top = '-9999px';
        dropdown.style.left = '-9999px';
        dropdown.style.display = 'block';
        dropdown.style.visibility = 'hidden';
        
        const dropdownRect = dropdown.getBoundingClientRect();
        const dropdownWidth = dropdownRect.width;
        const dropdownHeight = dropdownRect.height;
        
        // Restore original state
        dropdown.style.position = originalPosition;
        dropdown.style.top = originalTop;
        dropdown.style.left = originalLeft;
        dropdown.style.visibility = '';
        if (!wasVisible) {
            dropdown.style.display = 'none';
        }
        
        // Calculate initial position
        let top = preferBelow ? anchorTop + anchorHeight + offsetY : anchorTop - dropdownHeight + offsetY;
        let left = anchorLeft + offsetX;
        
        // Additional positioning classes for styling
        let positionClasses = [];
        
        // Vertical positioning adjustments
        if (preferBelow) {
            // Check if dropdown would go below viewport
            if (top + dropdownHeight > scrollY + viewportHeight - margin) {
                // Try positioning above
                const topAbove = anchorTop - dropdownHeight - Math.abs(offsetY);
                if (topAbove >= scrollY + margin) {
                    top = topAbove;
                    positionClasses.push('positioned-above');
                } else {
                    // If neither above nor below fits, position at bottom of viewport
                    top = scrollY + viewportHeight - dropdownHeight - margin;
                    positionClasses.push('positioned-bottom');
                }
            } else {
                positionClasses.push('positioned-below');
            }
        } else {
            // Check if dropdown would go above viewport
            if (top < scrollY + margin) {
                // Try positioning below
                const topBelow = anchorTop + anchorHeight + Math.abs(offsetY);
                if (topBelow + dropdownHeight <= scrollY + viewportHeight - margin) {
                    top = topBelow;
                    positionClasses.push('positioned-below');
                } else {
                    // If neither above nor below fits, position at top of viewport
                    top = scrollY + margin;
                    positionClasses.push('positioned-top');
                }
            } else {
                positionClasses.push('positioned-above');
            }
        }
        
        // Horizontal positioning adjustments
        if (preferRight) {
            // Check if dropdown would go beyond right edge
            if (left + dropdownWidth > scrollX + viewportWidth - margin) {
                // Try positioning to the left of anchor
                const leftToLeft = anchorLeft - dropdownWidth + Math.abs(offsetX);
                if (leftToLeft >= scrollX + margin) {
                    left = leftToLeft;
                    positionClasses.push('positioned-left');
                } else {
                    // If neither left nor right fits, position at right edge of viewport
                    left = scrollX + viewportWidth - dropdownWidth - margin;
                    positionClasses.push('positioned-right-edge');
                }
            } else {
                positionClasses.push('positioned-right');
            }
        } else {
            // Check if dropdown would go beyond left edge
            if (left < scrollX + margin) {
                // Try positioning to the right of anchor
                const leftToRight = anchorLeft + anchorWidth - Math.abs(offsetX);
                if (leftToRight + dropdownWidth <= scrollX + viewportWidth - margin) {
                    left = leftToRight;
                    positionClasses.push('positioned-right');
                } else {
                    // If neither left nor right fits, position at left edge of viewport
                    left = scrollX + margin;
                    positionClasses.push('positioned-left-edge');
                }
            } else {
                positionClasses.push('positioned-left');
            }
        }
        
        // Final bounds check - ensure dropdown stays within viewport
        left = Math.max(scrollX + margin, Math.min(left, scrollX + viewportWidth - dropdownWidth - margin));
        top = Math.max(scrollY + margin, Math.min(top, scrollY + viewportHeight - dropdownHeight - margin));
        
        return {
            top: top + 'px',
            left: left + 'px',
            classes: positionClasses,
            // Additional info for debugging/styling
            measurements: {
                viewport: { width: viewportWidth, height: viewportHeight },
                anchor: { top: anchorTop, left: anchorLeft, width: anchorWidth, height: anchorHeight },
                dropdown: { width: dropdownWidth, height: dropdownHeight },
                scroll: { x: scrollX, y: scrollY }
            }
        };
    }
    
    /**
     * Applies smart positioning to a dropdown element
     * @param {HTMLElement} anchorElement - The element that triggered the dropdown
     * @param {HTMLElement} dropdown - The dropdown element to position
     * @param {Object} options - Configuration options (same as calculatePosition)
     */
    function applySmartPosition(anchorElement, dropdown, options = {}) {
        const position = calculatePosition(anchorElement, dropdown, options);
        
        // Apply positioning
        dropdown.style.position = 'absolute';
        dropdown.style.top = position.top;
        dropdown.style.left = position.left;
        dropdown.style.zIndex = options.zIndex || '1000';
        
        // Add position classes for styling
        dropdown.classList.remove('positioned-above', 'positioned-below', 'positioned-left', 'positioned-right', 
                                  'positioned-top', 'positioned-bottom', 'positioned-left-edge', 'positioned-right-edge');
        position.classes.forEach(className => {
            dropdown.classList.add(className);
        });
        
        return position;
    }
    
    /**
     * Updates dropdown position on window resize or scroll
     * @param {HTMLElement} anchorElement - The element that triggered the dropdown
     * @param {HTMLElement} dropdown - The dropdown element to reposition
     * @param {Object} options - Configuration options
     * @returns {Function} Cleanup function to remove event listeners
     */
    function enableAutoReposition(anchorElement, dropdown, options = {}) {
        const updatePosition = () => {
            if (dropdown.parentNode && dropdown.style.display !== 'none') {
                applySmartPosition(anchorElement, dropdown, options);
            }
        };
        
        // Update on resize and scroll
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        
        // Return cleanup function
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }
    
    /**
     * Enhanced dropdown positioning for mobile devices
     * On mobile, prefer centering smaller dropdowns and using full-width for larger ones
     * @param {HTMLElement} anchorElement - The element that triggered the dropdown
     * @param {HTMLElement} dropdown - The dropdown element to position
     * @param {Object} options - Configuration options
     */
    function applyMobileOptimizedPosition(anchorElement, dropdown, options = {}) {
        const isMobile = window.innerWidth <= 768;
        
        if (!isMobile) {
            return applySmartPosition(anchorElement, dropdown, options);
        }
        
        // Mobile-specific options
        const mobileOptions = {
            ...options,
            margin: 15, // Larger margin on mobile
            preferBelow: true, // Always prefer below on mobile
            preferRight: true
        };
        
        // For small dropdowns on mobile, consider centering
        const dropdownWidth = dropdown.offsetWidth || 200;
        const viewportWidth = window.innerWidth;
        
        if (dropdownWidth < viewportWidth * 0.8) {
            // Small dropdown - use smart positioning
            return applySmartPosition(anchorElement, dropdown, mobileOptions);
        } else {
            // Large dropdown - make it full width with margins
            const margin = mobileOptions.margin;
            const anchorRect = anchorElement.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset;
            
            dropdown.style.position = 'absolute';
            dropdown.style.left = margin + 'px';
            dropdown.style.right = margin + 'px';
            dropdown.style.width = `calc(100vw - ${margin * 2}px)`;
            dropdown.style.top = (anchorRect.bottom + scrollY + 4) + 'px';
            dropdown.style.zIndex = mobileOptions.zIndex || '1000';
            
            dropdown.classList.add('mobile-full-width');
            
            return {
                top: dropdown.style.top,
                left: dropdown.style.left,
                classes: ['mobile-full-width', 'positioned-below'],
                measurements: {
                    viewport: { width: viewportWidth, height: window.innerHeight },
                    mobile: true
                }
            };
        }
    }
    
    // Public API
    return {
        calculatePosition,
        applySmartPosition,
        enableAutoReposition,
        applyMobileOptimizedPosition
    };
})();

// Make it globally available
window.DropdownPositioning = DropdownPositioning;
