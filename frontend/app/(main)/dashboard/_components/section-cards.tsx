import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cardsData } from "@/config/cards-data"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import clsx from "clsx"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-1 xl:grid-cols-3 lg:px-6">
      {cardsData.map((card, index) => {
        const TrendIcon =
          card.trend === "up" ? IconTrendingUp : IconTrendingDown

        return (
          <Card
            key={index}
            className={clsx(
              "@container/card bg-gradient-to-t shadow-xs",
              card.gradient
            )}
          >
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>

              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {card.value}
              </CardTitle>

              <CardAction>
                <Badge
                  variant="outline"
                  className={clsx(
                    "flex items-center gap-1",
                    card.trend === "up"
                      ? "text-emerald-600 border-emerald-600/30"
                      : "text-rose-600 border-rose-600/30"
                  )}
                >
                  <TrendIcon className="size-4" />
                  {card.percentage}
                </Badge>
              </CardAction>
            </CardHeader>

            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {card.description}
                <TrendIcon className="size-4" />
              </div>

              <div className="text-muted-foreground">{card.footer}</div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}