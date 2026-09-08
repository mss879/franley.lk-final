import { Gem, Truck, Banknote, MessagesSquare } from "lucide-react";

const PROPS = [
  { Icon: Gem, title: "Premium Quality Materials", body: "Carefully selected fabrics with refined finishes." },
  { Icon: Truck, title: "Islandwide Delivery", body: "Reliable delivery across Sri Lanka." },
  { Icon: Banknote, title: "Cash on Delivery", body: "Pay the courier when your order arrives, or by bank transfer." },
  { Icon: MessagesSquare, title: "Fast WhatsApp Support", body: "Quick assistance whenever you need help." },
];

export function ValueProps() {
  return (
    <section className="border-y border-cream-300 bg-cream-100">
      <div className="mx-auto grid max-w-[1400px] gap-px bg-cream-300 px-0 sm:grid-cols-2 lg:grid-cols-4">
        {PROPS.map(({ Icon, title, body }) => (
          <div key={title} className="bg-cream-100 px-6 py-10 md:px-8 md:py-12">
            <Icon className="h-6 w-6 text-wine-700" strokeWidth={1.25} aria-hidden />
            <h3 className="font-display mt-5 text-lg leading-snug">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
