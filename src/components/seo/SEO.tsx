import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: string;
}

const DEFAULT_TITLE = 'IOTA Playground | Move Smart Contract Development';
const DEFAULT_DESCRIPTION = 'Build, test, and deploy Move smart contracts on IOTA directly in your browser. The fastest and most powerful development environment for IOTA Move contracts with real-time compilation, testing, and deployment.';
const DEFAULT_KEYWORDS = [
  // Primary keywords
  'IOTA Move',
  'Move Smart Contracts',
  'IOTA Development',
  'Move Programming Language',
  'IOTA Playground',
  'IOTA IDE',
  // Secondary keywords
  'Web3 Development',
  'Blockchain Development',
  'Smart Contract IDE',
  'DLT Development',
  'IOTA Network',
  'IOTA Blockchain',
  // Long-tail keywords
  'Build Move Smart Contracts',
  'Deploy on IOTA',
  'Move Contract Development',
  'IOTA Smart Contract Testing',
  'Move Development Environment',
  'IOTA Testnet',
  'IOTA Mainnet',
  // Related terms
  'Move Virtual Machine',
  'Object-based Programming',
  'Zero Setup Development',
  'Browser-based IDE'
];

const DEFAULT_IMAGE = 'https://playground.iota.org/og-image.png';
const DEFAULT_URL = 'https://playground.iota.org';

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_IMAGE,
  url = DEFAULT_URL,
  type = 'website'
}: SEOProps) {
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | IOTA Playground`;

  useEffect(() => {
    // Update meta tags
    document.title = fullTitle;
    
    // Basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords.join(', '));

    // OpenGraph meta tags
    updateMetaTag('og:title', fullTitle);
    updateMetaTag('og:description', description);
    updateMetaTag('og:image', image);
    updateMetaTag('og:url', url);
    updateMetaTag('og:type', type);
    updateMetaTag('og:site_name', 'IOTA Playground - Move Smart Contract IDE');

    // Twitter meta tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);
    updateMetaTag('twitter:site', '@iota');

    // Additional meta tags for SEO
    updateMetaTag('application-name', 'IOTA Playground - Move Smart Contract IDE');
    updateMetaTag('apple-mobile-web-app-title', 'IOTA Playground');
    updateMetaTag('theme-color', '#000000');
    updateMetaTag('robots', 'index, follow, max-image-preview:large');
    updateMetaTag('googlebot', 'index, follow');
    updateMetaTag('author', 'IOTA Foundation');
    updateMetaTag('language', 'English');

    // Mobile meta tags
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', url);

    // Add JSON-LD structured data
    addStructuredData({
      title: fullTitle,
      description,
      image,
      url
    });
  }, [fullTitle, description, keywords, image, url, type]);

  return null;
}

function updateMetaTag(name: string, content: string) {
  // Try to find existing meta tag
  let meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  
  // Create new meta tag if it doesn't exist
  if (!meta) {
    meta = document.createElement('meta');
    // Use property for og: and twitter: tags, name for others
    if (name.startsWith('og:') || name.startsWith('twitter:')) {
      meta.setAttribute('property', name);
    } else {
      meta.setAttribute('name', name);
    }
    document.head.appendChild(meta);
  }
  
  // Update content
  meta.setAttribute('content', content);
}

function addStructuredData({ 
  title, 
  description, 
  image, 
  url 
}: { 
  title: string; 
  description: string; 
  image: string; 
  url: string; 
}) {
  // Remove any existing structured data
  const existingScript = document.querySelector('#structured-data');
  if (existingScript) {
    existingScript.remove();
  }

  // Create structured data script
  const script = document.createElement('script');
  script.setAttribute('id', 'structured-data');
  script.setAttribute('type', 'application/ld+json');

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    description: description,
    image: image,
    url: url,
    applicationCategory: 'DevelopmentApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    author: {
      '@type': 'Organization',
      name: 'IOTA Foundation',
      url: 'https://playground.iota.org'
    },
    browserRequirements: 'Requires a modern web browser with JavaScript enabled',
    featureList: [
      'Real-time Move compilation',
      'Smart contract deployment',
      'Built-in testing environment',
      'IOTA blockchain integration',
      'Zero setup required',
      'Browser-based development'
    ],
    keywords: DEFAULT_KEYWORDS.join(', '),
    softwareVersion: '1.0.0'
  };

  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
}