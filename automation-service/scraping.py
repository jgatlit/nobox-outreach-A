"""
Web scraping module to replace Apify functionality.
Handles website content extraction, tech stack detection, and company analysis.
"""

import asyncio
import aiohttp
import time
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import re
from loguru import logger

from config import settings

class WebScraper:
    """Advanced web scraper for lead enrichment."""
    
    def __init__(self, max_pages: int = 5, delay: float = 1.0, timeout: int = 30):
        self.max_pages = max_pages
        self.delay = delay
        self.timeout = timeout
        self.session = None
        
        # Headers to mimic real browser
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
    
    async def __aenter__(self):
        """Async context manager entry."""
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        self.session = aiohttp.ClientSession(
            headers=self.headers,
            timeout=timeout
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def scrape_domain(self, url: str) -> Dict[str, Any]:
        """
        Scrape a domain for company information.
        Replaces Apify actor functionality.
        """
        start_time = time.time()
        
        try:
            # Normalize URL
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'
            
            parsed_url = urlparse(url)
            base_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
            
            async with self:
                # Start with homepage
                pages_data = []
                urls_to_scrape = [url]
                scraped_urls = set()
                
                # Scrape pages
                for page_url in urls_to_scrape[:self.max_pages]:
                    if page_url in scraped_urls:
                        continue
                    
                    try:
                        page_data = await self._scrape_page(page_url)
                        if page_data:
                            pages_data.append(page_data)
                            scraped_urls.add(page_url)
                            
                            # Find internal links
                            internal_links = self._extract_internal_links(
                                page_data.get('html', ''), 
                                base_domain
                            )
                            
                            # Add priority pages
                            priority_paths = ['/about', '/services', '/products', '/team', '/contact']
                            for link in internal_links:
                                if any(path in link.lower() for path in priority_paths):
                                    if link not in urls_to_scrape and len(urls_to_scrape) < self.max_pages:
                                        urls_to_scrape.append(link)
                        
                        # Respectful delay
                        await asyncio.sleep(self.delay)
                        
                    except Exception as e:
                        logger.warning(f"Failed to scrape page {page_url}: {str(e)}")
                        continue
                
                # Analyze collected data
                result = self._analyze_scraped_data(pages_data, base_domain)
                result['scraping_time'] = time.time() - start_time
                result['pages_scraped'] = len(pages_data)
                
                return result
                
        except Exception as e:
            logger.error(f"Domain scraping failed for {url}: {str(e)}")
            return {
                'error': str(e),
                'url': url,
                'pages': [],
                'tech_stack': [],
                'company_info': {},
                'scraping_time': time.time() - start_time
            }
    
    async def _scrape_page(self, url: str) -> Optional[Dict[str, Any]]:
        """Scrape individual page content."""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.warning(f"HTTP {response.status} for {url}")
                    return None
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Extract content
                page_data = {
                    'url': url,
                    'html': html,
                    'title': self._extract_title(soup),
                    'meta_description': self._extract_meta_description(soup),
                    'headings': self._extract_headings(soup),
                    'content': self._extract_text_content(soup),
                    'images': self._extract_images(soup),
                    'links': self._extract_links(soup),
                    'tech_indicators': self._detect_technologies(html, soup),
                    'contact_info': self._extract_contact_info(soup),
                    'social_links': self._extract_social_links(soup)
                }
                
                return page_data
                
        except Exception as e:
            logger.error(f"Page scraping failed for {url}: {str(e)}")
            return None
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title."""
        title_tag = soup.find('title')
        return title_tag.get_text().strip() if title_tag else ''
    
    def _extract_meta_description(self, soup: BeautifulSoup) -> str:
        """Extract meta description."""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            return meta_desc.get('content', '').strip()
        
        # Try property="description"
        meta_desc = soup.find('meta', attrs={'property': 'og:description'})
        if meta_desc:
            return meta_desc.get('content', '').strip()
        
        return ''
    
    def _extract_headings(self, soup: BeautifulSoup) -> List[Dict[str, str]]:
        """Extract all headings."""
        headings = []
        for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            text = tag.get_text().strip()
            if text:
                headings.append({
                    'level': tag.name,
                    'text': text
                })
        return headings
    
    def _extract_text_content(self, soup: BeautifulSoup) -> str:
        """Extract main text content."""
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer"]):
            script.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Limit length
        return text[:5000] if text else ''
    
    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        """Extract image sources."""
        images = []
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if src:
                images.append(src)
        return images[:10]  # Limit to first 10 images
    
    def _extract_links(self, soup: BeautifulSoup) -> List[str]:
        """Extract links."""
        links = []
        for link in soup.find_all('a', href=True):
            href = link['href']
            if href and not href.startswith(('#', 'javascript:', 'mailto:')):
                links.append(href)
        return links[:20]  # Limit to first 20 links
    
    def _extract_contact_info(self, soup: BeautifulSoup) -> Dict[str, List[str]]:
        """Extract contact information."""
        text = soup.get_text()
        
        # Email regex
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        
        # Phone regex (basic US/international patterns)
        phone_pattern = r'[\+]?[1-9]?[0-9]{7,15}'
        phones = re.findall(phone_pattern, text)
        
        # Address patterns (simplified)
        address_indicators = ['address', 'location', 'office', 'headquarters']
        addresses = []
        
        for indicator in address_indicators:
            if indicator.lower() in text.lower():
                # This is simplified - more sophisticated address extraction would be needed
                break
        
        return {
            'emails': list(set(emails))[:5],  # Dedupe and limit
            'phones': list(set(phones))[:3],
            'addresses': addresses
        }
    
    def _extract_social_links(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract social media links."""
        social_platforms = {
            'linkedin': r'linkedin\.com',
            'twitter': r'twitter\.com',
            'facebook': r'facebook\.com',
            'instagram': r'instagram\.com',
            'youtube': r'youtube\.com'
        }
        
        social_links = {}
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            for platform, pattern in social_platforms.items():
                if re.search(pattern, href, re.IGNORECASE):
                    social_links[platform] = href
                    break
        
        return social_links
    
    def _detect_technologies(self, html: str, soup: BeautifulSoup) -> List[str]:
        """
        Detect technologies used on the website.
        Simplified version of Wappalyzer-style detection.
        """
        tech_stack = []
        
        # JavaScript frameworks/libraries
        js_patterns = {
            'React': [r'react', r'_react', r'React\.'],
            'Vue.js': [r'vue\.js', r'Vue\.'],
            'Angular': [r'angular', r'ng-'],
            'jQuery': [r'jquery', r'\$\.'],
            'Next.js': [r'next\.js', r'_next'],
            'Nuxt.js': [r'nuxt\.js', r'_nuxt'],
            'Svelte': [r'svelte'],
        }
        
        # CSS frameworks
        css_patterns = {
            'Bootstrap': [r'bootstrap', r'btn-primary'],
            'Tailwind CSS': [r'tailwindcss', r'tw-'],
            'Bulma': [r'bulma'],
            'Foundation': [r'foundation']
        }
        
        # Analytics and tracking
        analytics_patterns = {
            'Google Analytics': [r'google-analytics', r'gtag'],
            'Google Tag Manager': [r'googletagmanager'],
            'Facebook Pixel': [r'fbevents', r'facebook\.com/tr'],
            'Hotjar': [r'hotjar'],
            'Mixpanel': [r'mixpanel']
        }
        
        # CMS/Platforms
        platform_patterns = {
            'WordPress': [r'wp-content', r'wordpress'],
            'Shopify': [r'shopify', r'cdn\.shopify'],
            'Squarespace': [r'squarespace'],
            'Wix': [r'wix\.com'],
            'Webflow': [r'webflow']
        }
        
        all_patterns = {
            **js_patterns,
            **css_patterns,
            **analytics_patterns,
            **platform_patterns
        }
        
        html_lower = html.lower()
        
        for tech, patterns in all_patterns.items():
            for pattern in patterns:
                if re.search(pattern, html_lower):
                    tech_stack.append(tech)
                    break
        
        # Check meta tags for additional info
        generator = soup.find('meta', attrs={'name': 'generator'})
        if generator:
            content = generator.get('content', '').lower()
            if 'wordpress' in content:
                tech_stack.append('WordPress')
            elif 'shopify' in content:
                tech_stack.append('Shopify')
        
        return list(set(tech_stack))  # Remove duplicates
    
    def _extract_internal_links(self, html: str, base_domain: str) -> List[str]:
        """Extract internal links from HTML."""
        soup = BeautifulSoup(html, 'html.parser')
        internal_links = []
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            
            # Skip empty, fragment, or javascript links
            if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
            
            # Convert relative links to absolute
            full_url = urljoin(base_domain, href)
            
            # Check if it's internal
            if urlparse(full_url).netloc == urlparse(base_domain).netloc:
                internal_links.append(full_url)
        
        return list(set(internal_links))  # Remove duplicates
    
    def _analyze_scraped_data(self, pages_data: List[Dict[str, Any]], base_domain: str) -> Dict[str, Any]:
        """Analyze scraped data to extract company insights."""
        if not pages_data:
            return {
                'url': base_domain,
                'pages': [],
                'tech_stack': [],
                'company_info': {},
                'content_analysis': {}
            }
        
        # Combine tech stacks
        all_tech = []
        for page in pages_data:
            all_tech.extend(page.get('tech_indicators', []))
        tech_stack = list(set(all_tech))
        
        # Extract company information
        company_info = self._extract_company_info(pages_data)
        
        # Content analysis
        all_text = ' '.join(page.get('content', '') for page in pages_data)
        content_analysis = self._analyze_content(all_text)
        
        return {
            'url': base_domain,
            'pages': pages_data,
            'tech_stack': tech_stack,
            'company_info': company_info,
            'content_analysis': content_analysis,
            'summary': {
                'total_pages': len(pages_data),
                'technologies_detected': len(tech_stack),
                'has_contact_info': bool(company_info.get('contact_info')),
                'content_quality': content_analysis.get('quality_score', 0)
            }
        }
    
    def _extract_company_info(self, pages_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract company information from scraped pages."""
        company_info = {
            'name': '',
            'description': '',
            'industry': '',
            'size': '',
            'location': '',
            'contact_info': {}
        }
        
        # Extract from page titles and descriptions
        titles = [page.get('title', '') for page in pages_data if page.get('title')]
        descriptions = [page.get('meta_description', '') for page in pages_data if page.get('meta_description')]
        
        if titles:
            # Use homepage title as company name (simplified)
            company_info['name'] = titles[0].split(' | ')[0].split(' - ')[0]
        
        if descriptions:
            # Use first meaningful description
            company_info['description'] = descriptions[0]
        
        # Aggregate contact info
        all_contacts = {'emails': [], 'phones': [], 'addresses': []}
        for page in pages_data:
            contact = page.get('contact_info', {})
            all_contacts['emails'].extend(contact.get('emails', []))
            all_contacts['phones'].extend(contact.get('phones', []))
            all_contacts['addresses'].extend(contact.get('addresses', []))
        
        # Deduplicate contact info
        company_info['contact_info'] = {
            'emails': list(set(all_contacts['emails'])),
            'phones': list(set(all_contacts['phones'])),
            'addresses': list(set(all_contacts['addresses']))
        }
        
        return company_info
    
    def _analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze combined content for insights."""
        if not content:
            return {'quality_score': 0, 'topics': [], 'sentiment': 'neutral'}
        
        content_lower = content.lower()
        
        # Simple topic detection based on keywords
        business_keywords = {
            'technology': ['software', 'tech', 'digital', 'platform', 'solution', 'system'],
            'consulting': ['consulting', 'advisory', 'strategy', 'expert', 'professional'],
            'marketing': ['marketing', 'advertising', 'brand', 'campaign', 'social media'],
            'finance': ['financial', 'accounting', 'investment', 'banking', 'insurance'],
            'healthcare': ['healthcare', 'medical', 'health', 'patient', 'clinical'],
            'education': ['education', 'learning', 'training', 'course', 'university'],
            'retail': ['retail', 'ecommerce', 'shopping', 'store', 'product'],
            'manufacturing': ['manufacturing', 'production', 'factory', 'industrial']
        }
        
        detected_topics = []
        for topic, keywords in business_keywords.items():
            if any(keyword in content_lower for keyword in keywords):
                detected_topics.append(topic)
        
        # Basic quality assessment
        quality_indicators = {
            'has_contact': any(word in content_lower for word in ['contact', 'phone', 'email', 'address']),
            'has_services': any(word in content_lower for word in ['services', 'solutions', 'products', 'offerings']),
            'has_about': any(word in content_lower for word in ['about', 'company', 'team', 'mission']),
            'sufficient_content': len(content.split()) > 100
        }
        
        quality_score = sum(quality_indicators.values()) * 25  # Score out of 100
        
        return {
            'quality_score': quality_score,
            'topics': detected_topics[:3],  # Top 3 topics
            'word_count': len(content.split()),
            'has_business_content': bool(detected_topics)
        }