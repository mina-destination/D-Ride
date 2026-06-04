import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
}

export default function SEO({ title, description, keywords }: SEOProps) {
  useEffect(() => {
    const brand = 'D-Ride';
    const formattedTitle = title.includes(brand) ? title : `${title} | ${brand}`;
    
    // 1. Update Document Title
    document.title = formattedTitle;

    // Helper to add or update meta tags
    const setMetaTag = (attribute: string, attrValue: string, contentValue: string) => {
      let tag = document.querySelector(`meta[${attribute}="${attrValue}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', contentValue);
    };

    // 2. Update Meta Description
    if (description) {
      setMetaTag('name', 'description', description);
      setMetaTag('property', 'og:description', description);
      setMetaTag('name', 'twitter:description', description);
    }

    // 3. Update Meta Keywords
    const defaultKeywords = 'd-ride, mass transit egypt, bus booking egypt, cairo, alexandria, sharm el sheikh, dahab, nuweiba, taba, القاهرة, الاسكندرية, شرم الشيخ, دهب, نويبع, طابا';
    const finalKeywords = keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords;
    setMetaTag('name', 'keywords', finalKeywords);

    // 4. Update Canonical URL (prevents duplicate content penalty)
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    const canonicalUrl = window.location.origin + window.location.pathname;
    canonical.setAttribute('href', canonicalUrl);

    // 5. Update Open Graph & Twitter Titles / URL
    setMetaTag('property', 'og:title', formattedTitle);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('name', 'twitter:title', formattedTitle);

    // 6. Homepage JSON-LD Structured Data Schema (Official Site Name Declaration)
    const isHomepage = window.location.pathname === '/';
    const scriptId = 'json-ld-website-schema';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement;

    if (isHomepage) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = scriptId;
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }

      const websiteData = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': 'https://d-ride.com/#website',
            'url': 'https://d-ride.com/',
            'name': 'D-Ride',
            'alternateName': ['دي-رايد', 'DRide', 'D Ride'],
            'description': 'Smart Mass-Transit & Bus Booking in Egypt'
          },
          {
            '@type': 'Organization',
            '@id': 'https://d-ride.com/#organization',
            'name': 'D-Ride',
            'url': 'https://d-ride.com/',
            'logo': 'https://d-ride.com/favicon.png',
            'sameAs': [
              'https://www.facebook.com/d-ride',
              'https://www.instagram.com/d-ride'
            ]
          }
        ]
      };

      scriptTag.textContent = JSON.stringify(websiteData);
    }

    return () => {
      // Clean up dynamic structured data script when component unmounts
      if (isHomepage && scriptTag) {
        scriptTag.remove();
      }
    };
  }, [title, description, keywords]);

  return null;
}

