import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Do all plans really include all current features?",
    answer:
      "Yes! Every Trackure plan gets you access to our core V1 features, including workflow customization, rework tracking, packaging reminders, and PDF generation. However, Professional and Business plans get exclusive access to new features, priority feature requests, and beta program access.",
  },
  {
    question:
      "What's the benefit of Professional and Business plans regarding new features?",
    answer:
      "Professional and Business plan subscribers get access to new features before they're released to Essentials plan users. They also get to participate in our beta program and can submit priority feature requests that influence our development roadmap.",
  },
  {
    question: 'What counts as an "Active Order" or "Active Item"?',
    answer:
      'An "Active Order" is any order that has not yet reached your final "Ready for Dispatch" stage (or equivalent) for more than 7 days. "Active Items" are all items within those active orders. For example, if you have 2 active orders with 30 items each, that counts as 2 Active Orders and 60 Active Items against your monthly limit.',
  },
  {
    question: "What happens if I go over my limits?",
    answer:
      "We'll notify you when you're approaching 80% of your limits. We don't suddenly cut off access, but we'll work with you to either optimize your workflow or upgrade to a plan that better fits your growing needs. For example, if you're on the Essentials plan and consistently handling more than 3 orders or 100 items per month, we'll recommend upgrading to the Professional plan.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Absolutely! Every new Trackure account starts with a 14-day free trial of our Professional plan, giving you full access to see how it can transform your workflow. No credit card required to start.",
  },
  {
    question: "Can I change my plan later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time from your account settings. Changes will be pro-rated.",
  },
  {
    question: "What kind of support is included?",
    answer:
      "All plans include email support. Professional and Business plans get priority email support, and the Business plan also includes access to chat support.",
  },
  {
    question: "How secure is my data?",
    answer:
      "We take data security very seriously. Trackure is built on industry-standard secure infrastructure (Supabase), and your organization's data is kept separate.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No! Trackure is a fully web-based application. All you need is an internet connection and a modern web browser.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, you can cancel your subscription at any time. If you cancel, your service will continue until the end of your current paid billing period.",
  },
];

export function FAQSection() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-white text-center mb-12">
        Have Questions? We Have Answers.
      </h2>
      <Accordion type="single" collapsible className="space-y-4">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="bg-gray-900/50 rounded-lg"
          >
            <AccordionTrigger className="px-6 text-white hover:text-white">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4 text-gray-300">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
