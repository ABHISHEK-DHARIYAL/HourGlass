// Purpose: Local fallback pool of motivational quotes used when the /api/quote endpoint is unreachable, so the header quote can always rotate

export interface Quote {
  text: string;
  author: string;
}

export const FALLBACK_QUOTES: Quote[] = [
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: 'Stephen Covey' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  { text: 'Either you run the day, or the day runs you.', author: 'Jim Rohn' },
  { text: 'It is not enough to be busy; so are the ants. The question is: what are we busy about?', author: 'Henry David Thoreau' },
  { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Your time is limited, so do not waste it living someone else\'s life.', author: 'Steve Jobs' },
  { text: 'You may delay, but time will not.', author: 'Benjamin Franklin' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'What we fear doing most is usually what we most need to do.', author: 'Tim Ferriss' },
  { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Well begun is half done.', author: 'Aristotle' },
  { text: 'Until we can manage time, we can manage nothing else.', author: 'Peter Drucker' },
  { text: 'The best way to predict the future is to create it.', author: 'Peter Drucker' },
  { text: 'Do something today that your future self will thank you for.', author: 'Sean Patrick Flanery' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
];

// Picks a random fallback quote that differs from the one currently shown.
export function pickFallbackQuote(currentText?: string): Quote {
  const pool = FALLBACK_QUOTES.filter(q => q.text !== currentText);
  return pool[Math.floor(Math.random() * pool.length)];
}
