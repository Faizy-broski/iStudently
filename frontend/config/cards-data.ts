import {
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconCash,
  IconUserPlus,
} from "@tabler/icons-react"

export const cardsData = [
  {
    title: "Total Revenue",
    value: "$1,250.00",
    trend: "up",
    percentage: "+12.5%",
    description: "Trending up this month",
    footer: "Visitors for the last 6 months",
    icon: IconCash,
    gradient: "from-emerald-500/10 to-emerald-500/5",
  },
  {
    title: "New Customers",
    value: "1,234",
    trend: "down",
    percentage: "-20%",
    description: "Down 20% this period",
    footer: "Acquisition needs attention",
    icon: IconUserPlus,
    gradient: "from-rose-500/10 to-rose-500/5",
  },
  {
    title: "Active Accounts",
    value: "45,678",
    trend: "up",
    percentage: "+12.5%",
    description: "Strong user retention",
    footer: "Engagement exceeds targets",
    icon: IconUsers,
    gradient: "from-blue-500/10 to-blue-500/5",
  },
]