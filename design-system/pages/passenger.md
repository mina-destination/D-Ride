# Passenger Portal Overrides

## 📱 Mobile-First Commuter Companion Layouts

- **Primary Container Max-Width:** Mobile views are optimized for `max-w-md mx-auto px-4` to prevent horizontal scaling issues on mobile viewports.
- **Minibus Seat Chassis layout:** Toyota HiAce 14-seater grid layout. Spacing between seats is exactly 8px (`gap-2`) to avoid touch collisions on smaller screens. 
- **Tap targets:** The seat selection boxes must have a minimum interactive tap target size of `44x44px` with standard touch area extensions.
- **Dynamic Capacity Badge:** Use `#ef4444` for low seat availability warnings (e.g., `< 3 seats left`) and `#ffcc33` for positive availability.
- **Glassmorphism:** Bottom navigation overlay and sheet panels use `backdrop-blur-md bg-[#10131a]/80 border-t border-white/10`.
