import {
  Home,
  ShoppingBasket,
  Utensils,
  Car,
  Tv,
  ShoppingBag,
  Zap,
  Heart,
  Plane,
  Shield,
  Sparkles,
  ArrowRightLeft,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'Rent & Housing': Home,
  Groceries: ShoppingBasket,
  'Dining & Bars': Utensils,
  Transport: Car,
  Subscriptions: Tv,
  Shopping: ShoppingBag,
  Utilities: Zap,
  Healthcare: Heart,
  Travel: Plane,
  Insurance: Shield,
  Entertainment: Sparkles,
  'Transfer Out': ArrowRightLeft,
  Other: HelpCircle,
}

/**
 * Maps a spending category name to its corresponding lucide-react icon.
 * Returns HelpCircle for unknown or uncategorized categories.
 */
export function getCategoryIcon(category: string): LucideIcon {
  return CATEGORY_ICON_MAP[category] ?? HelpCircle
}
