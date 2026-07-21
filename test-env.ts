console.log('Environment variables:');
for (const [key, val] of Object.entries(process.env)) {
  if (key.includes('FIREBASE') || key.includes('GOOGLE') || key.includes('VITE') || key.includes('PROJECT')) {
    console.log(`${key}=${val}`);
  }
}
