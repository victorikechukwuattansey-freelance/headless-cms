/**
 * Batch template builder for the Restaurant Social Media Kit.
 * Generates all 40 templates in Affinity Designer via the MCP automation layer.
 */

import { AffinityDesignerMCPTools } from '../src/tools/affinity-tools';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT = resolve(__dirname, '..', '..', 'restaurant-kit-output', 'affinity-templates');
const COLORS = {
  charcoal:   { r: 26, g: 26, b: 26 },
  cream:      { r: 250, g: 246, b: 240 },
  terracotta: { r: 200, g: 85, b: 61 },
  olive:      { r: 107, g: 143, b: 94 },
  gold:       { r: 232, g: 184, b: 75 },
  white:      { r: 255, g: 255, b: 255 },
};

interface TemplateSpec {
  num: number;
  name: string;
  section: string;
  format: 'square' | 'story' | 'carousel';
  bg: string;
  elements: Element[];
}

interface Element {
  type: 'rect' | 'text' | 'badge' | 'circle';
  props: Record<string, any>;
}

const DIMS = {
  square:   { w: 1080, h: 1080 },
  story:    { w: 1080, h: 1920 },
  carousel: { w: 1080, h: 1350 },
};

const templates: TemplateSpec[] = [
  // ========== MENU & DISHES ==========
  { num:1, name:'Dish Spotlight', section:'Menu', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:540, h:1080, fill:'cream' } },
      { type:'rect', props:{ x:540, y:0, w:540, h:1080, fill:'white' } },
      { type:'text', props:{ x:580, y:300, text:'Dish Name', size:36, font:'Playfair Display' } },
      { type:'text', props:{ x:580, y:360, text:'Description', size:18 } },
      { type:'badge', props:{ x:580, y:500, text:'$XX', color:'gold' } },
    ]},
  { num:2, name:'Daily Special', section:'Menu', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:540, fill:'cream' } },
      { type:'rect', props:{ x:0, y:540, w:1080, h:540, fill:'white' } },
      { type:'badge', props:{ x:40, y:560, text:"Today's Special", color:'terracotta' } },
      { type:'text', props:{ x:40, y:620, text:'Grilled Salmon', size:32, font:'Playfair Display' } },
      { type:'text', props:{ x:40, y:670, text:'Served with seasonal vegetables', size:18 } },
    ]},
  { num:3, name:"Chef's Pick", section:'Menu', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'badge', props:{ x:40, y:40, text:"Chef's Pick", color:'gold' } },
      { type:'text', props:{ x:40, y:800, text:'Wagyu Burger', size:36, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:40, y:860, text:'Dry-aged, truffle aioli, brioche bun', size:16, color:'white' } },
    ]},
  { num:4, name:'Platter Close-up', section:'Menu', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'text', props:{ x:60, y:800, text:'Sunday Roast Platter', size:32, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:850, text:'Feeds 2', size:16, color:'white' } },
      { type:'badge', props:{ x:60, y:900, text:'$38', color:'gold' } },
    ]},
  { num:5, name:'New Menu Item', section:'Menu', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'rect', props:{ x:80, y:100, w:920, h:700, fill:'cream' } },
      { type:'text', props:{ x:80, y:850, text:'New on the Menu', size:28, font:'Playfair Display' } },
    ]},
  { num:6, name:'Ingredient Hero', section:'Menu', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'circle', props:{ cx:540, cy:350, r:160, fill:'cream' } },
      { type:'text', props:{ x:540, y:600, text:'San Marzano Tomatoes', size:28, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:650, text:'Imported from Italy', size:16, align:'center' } },
    ]},
  { num:7, name:'Combo Deal', section:'Menu', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'cream' } },
      { type:'rect', props:{ x:40, y:40, w:300, h:700, fill:'white' } },
      { type:'rect', props:{ x:390, y:40, w:300, h:700, fill:'white' } },
      { type:'rect', props:{ x:740, y:40, w:300, h:700, fill:'white' } },
      { type:'badge', props:{ x:800, y:880, text:'$15.99', color:'gold' } },
      { type:'text', props:{ x:40, y:820, text:'Burger + Fries + Drink', size:22 } },
    ]},
  { num:8, name:'Drink Special', section:'Menu', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:540, h:1080, fill:'charcoal' } },
      { type:'rect', props:{ x:540, y:0, w:540, h:1080, fill:'cream' } },
      { type:'text', props:{ x:60, y:300, text:'Summer Spritz', size:36, color:'gold', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:360, text:'Aperol / Prosecco / Soda', size:16, color:'white' } },
      { type:'badge', props:{ x:60, y:440, text:'$12', color:'gold' } },
    ]},
  { num:9, name:'Dessert Feature', section:'Menu', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'circle', props:{ cx:540, cy:340, r:160, fill:'cream' } },
      { type:'text', props:{ x:540, y:600, text:'Tiramisu', size:32, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:660, text:'House-made / Mascarpone / Espresso', size:16, color:'white', align:'center' } },
      { type:'badge', props:{ x:540, y:720, text:'$9', color:'gold' } },
    ]},
  { num:10, name:'Our Menu Carousel', section:'Menu', format:'carousel', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1350, fill:'cream' } },
      { type:'text', props:{ x:540, y:500, text:'Our Menu', size:48, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:580, text:'Swipe to explore', size:20, align:'center' } },
    ]},

  // ========== PROMOTIONS ==========
  { num:11, name:'Happy Hour', section:'Promo', format:'square', bg:'terracotta',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'terracotta' } },
      { type:'text', props:{ x:540, y:380, text:'HAPPY HOUR', size:56, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:460, text:'Mon-Fri / 4PM-6PM', size:22, color:'white', align:'center' } },
      { type:'badge', props:{ x:540, y:540, text:'50% OFF Drinks', color:'gold' } },
    ]},
  { num:12, name:'Limited Offer', section:'Promo', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'text', props:{ x:540, y:380, text:'Limited Offer', size:36, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:440, text:'Ends Sunday', size:22, color:'gold', align:'center' } },
    ]},
  { num:13, name:'BOGO', section:'Promo', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:540, h:1080, fill:'cream' } },
      { type:'rect', props:{ x:540, y:0, w:540, h:1080, fill:'olive' } },
      { type:'text', props:{ x:270, y:480, text:'BUY 1', size:48, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:810, y:480, text:'GET 1', size:48, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:810, y:550, text:'Free', size:22, color:'white', align:'center' } },
    ]},
  { num:14, name:'Loyalty Promo', section:'Promo', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'rect', props:{ x:160, y:240, w:760, h:400, fill:'cream' } },
      { type:'text', props:{ x:540, y:520, text:'Loyalty Card', size:24, align:'center' } },
      { type:'text', props:{ x:540, y:760, text:'Earn points with every visit', size:18, align:'center' } },
    ]},
  { num:15, name:'Student Discount', section:'Promo', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'cream' } },
      { type:'text', props:{ x:540, y:420, text:'Student Discount', size:32, align:'center', font:'Playfair Display' } },
      { type:'badge', props:{ x:540, y:500, text:'15% OFF', color:'terracotta' } },
      { type:'text', props:{ x:540, y:560, text:'With valid ID', size:18, align:'center' } },
    ]},
  { num:16, name:'Family Meal Deal', section:'Promo', format:'square', bg:'olive',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'olive' } },
      { type:'badge', props:{ x:40, y:40, text:'Feeds 4', color:'gold' } },
      { type:'text', props:{ x:40, y:800, text:'Family Feast', size:36, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:40, y:860, text:'2 mains / 2 sides / 4 drinks / $49', size:16, color:'white' } },
    ]},
  { num:17, name:'Free Delivery', section:'Promo', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'text', props:{ x:540, y:420, text:'Free Delivery', size:36, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:490, text:'On orders over $25', size:20, align:'center' } },
      { type:'text', props:{ x:540, y:530, text:'Within 5km radius', size:16, align:'center' } },
    ]},
  { num:18, name:'First Visit Offer', section:'Promo', format:'square', bg:'terracotta',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'terracotta' } },
      { type:'text', props:{ x:540, y:380, text:'First time?', size:36, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:440, text:"Welcome! Here's 10% off", size:22, color:'white', align:'center' } },
      { type:'text', props:{ x:540, y:520, text:'WELCOME10', size:20, color:'gold', align:'center' } },
    ]},

  // ========== EVENTS & SEASONAL ==========
  { num:19, name:'Live Music Night', section:'Event', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'text', props:{ x:60, y:780, text:'Live Jazz Night', size:32, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:840, text:'Every Friday / 7PM-10PM', size:16, color:'white' } },
      { type:'badge', props:{ x:60, y:900, text:'Book a Table', color:'gold' } },
    ]},
  { num:20, name:'Holiday Special', section:'Event', format:'square', bg:'terracotta',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'terracotta' } },
      { type:'text', props:{ x:540, y:400, text:'Holiday Special', size:42, color:'gold', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:470, text:'Special Menu', size:22, color:'white', align:'center' } },
    ]},
  { num:21, name:'Weekend Brunch', section:'Event', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'cream' } },
      { type:'text', props:{ x:60, y:780, text:'Weekend Brunch', size:36, font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:840, text:'Sat-Sun / 9AM-2PM', size:18 } },
    ]},
  { num:22, name:'New Year Party', section:'Event', format:'story', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1920, fill:'charcoal' } },
      { type:'text', props:{ x:540, y:700, text:'2026', size:72, color:'gold', align:'center', font:'Playfair Display' } },
      { type:'badge', props:{ x:540, y:820, text:'Book Your Table', color:'gold' } },
    ]},
  { num:23, name:"Valentine's Dinner", section:'Event', format:'square', bg:'terracotta',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'terracotta' } },
      { type:'text', props:{ x:60, y:780, text:"Valentine's Dinner", size:32, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:840, text:'Feb 14 / Reserve your table', size:16, color:'white' } },
    ]},
  { num:24, name:'Seasonal Menu Launch', section:'Event', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:540, fill:'cream' } },
      { type:'rect', props:{ x:0, y:540, w:1080, h:540, fill:'white' } },
      { type:'text', props:{ x:40, y:580, text:'Introducing Spring Menu', size:28, font:'Playfair Display' } },
      { type:'text', props:{ x:40, y:630, text:'Seasonal / Farm-fresh / New flavours', size:16 } },
    ]},

  // ========== BEHIND THE SCENES ==========
  { num:25, name:'Meet the Chef', section:'BTS', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:540, h:1080, fill:'cream' } },
      { type:'rect', props:{ x:540, y:0, w:540, h:1080, fill:'white' } },
      { type:'text', props:{ x:580, y:380, text:'"Fresh ingredients, simple techniques."', size:18, font:'Playfair Display' } },
      { type:'text', props:{ x:580, y:460, text:'Chef Marco', size:24, font:'Playfair Display' } },
      { type:'text', props:{ x:580, y:500, text:'Head Chef / 12 years', size:14 } },
    ]},
  { num:26, name:'Kitchen Prep', section:'BTS', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'text', props:{ x:60, y:800, text:'Made Fresh Daily', size:32, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:860, text:'Every dish prepared in-house', size:16, color:'white' } },
    ]},
  { num:27, name:'Ingredient Source', section:'BTS', format:'square', bg:'olive',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'olive' } },
      { type:'text', props:{ x:60, y:800, text:'From Farm to Table', size:32, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:860, text:'Sourced from local farms', size:16, color:'white' } },
    ]},
  { num:28, name:'Staff Spotlight', section:'BTS', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:540, h:1080, fill:'cream' } },
      { type:'rect', props:{ x:540, y:0, w:540, h:1080, fill:'white' } },
      { type:'text', props:{ x:580, y:420, text:'Maria Santos', size:28, font:'Playfair Display' } },
      { type:'text', props:{ x:580, y:470, text:'Lead Server', size:18 } },
      { type:'text', props:{ x:580, y:510, text:'5 years / Customer favourite', size:14 } },
    ]},

  // ========== TESTIMONIALS ==========
  { num:29, name:'Customer Review', section:'Testimonial', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'text', props:{ x:540, y:420, text:'"The best pasta I have had outside of Italy. Unreal flavour."', size:22, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:520, text:'★★★★★', size:28, color:'gold', align:'center' } },
      { type:'text', props:{ x:540, y:560, text:'&mdash; Sarah M.', size:16, align:'center' } },
    ]},
  { num:30, name:'Most Loved Dish', section:'Testimonial', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'badge', props:{ x:40, y:40, text:'Most Ordered', color:'gold' } },
      { type:'text', props:{ x:60, y:800, text:'Truffle Risotto', size:32, color:'white', font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:860, text:'250+ orders this month', size:16, color:'white' } },
    ]},
  { num:31, name:'Media Feature', section:'Testimonial', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'text', props:{ x:540, y:440, text:'"A hidden gem in the city."', size:26, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:520, text:'Food & Wine Magazine', size:16, color:'gold', align:'center' } },
    ]},
  { num:32, name:'Rating Promo', section:'Testimonial', format:'story', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1920, fill:'cream' } },
      { type:'text', props:{ x:540, y:700, text:'4.8', size:72, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:800, text:'★★★★★', size:36, color:'gold', align:'center' } },
      { type:'text', props:{ x:540, y:860, text:'Google Reviews', size:20, align:'center' } },
      { type:'badge', props:{ x:540, y:940, text:'Leave a Review', color:'terracotta' } },
    ]},

  // ========== HOURS & INFO ==========
  { num:33, name:'Open Hours', section:'Info', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'text', props:{ x:540, y:350, text:'Hours', size:36, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:440, text:'Mon-Thu: 11AM-10PM', size:18, align:'center' } },
      { type:'text', props:{ x:540, y:490, text:'Fri-Sat: 11AM-11PM', size:18, align:'center' } },
      { type:'text', props:{ x:540, y:540, text:'Sun: 10AM-8PM', size:18, align:'center' } },
    ]},
  { num:34, name:'Location', section:'Info', format:'square', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:540, fill:'cream' } },
      { type:'rect', props:{ x:0, y:540, w:1080, h:540, fill:'white' } },
      { type:'text', props:{ x:40, y:580, text:'Visit Us', size:28, font:'Playfair Display' } },
      { type:'text', props:{ x:40, y:630, text:'123 High Street, Manchester', size:16 } },
    ]},
  { num:35, name:'Delivery Info', section:'Info', format:'square', bg:'white',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'white' } },
      { type:'text', props:{ x:540, y:400, text:'Delivery Zone', size:32, align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:470, text:'Within 5km / Min. $20', size:18, align:'center' } },
      { type:'text', props:{ x:540, y:520, text:'Free delivery over $30', size:16, align:'center' } },
      { type:'text', props:{ x:540, y:570, text:'ETA: 30-45 min', size:16, color:'terracotta', align:'center' } },
    ]},
  { num:36, name:'Contact', section:'Info', format:'square', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1080, fill:'charcoal' } },
      { type:'text', props:{ x:540, y:420, text:'Get in Touch', size:36, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:500, text:'0161 123 4567', size:20, color:'white', align:'center' } },
      { type:'text', props:{ x:540, y:550, text:'hello@resto.com', size:18, color:'white', align:'center' } },
    ]},

  // ========== STORIES ==========
  { num:37, name:'Promo Story', section:'Story', format:'story', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1920, fill:'charcoal' } },
      { type:'text', props:{ x:540, y:700, text:'Pizza Night', size:56, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:780, text:'Every Tuesday / 2-for-1', size:22, color:'white', align:'center' } },
      { type:'badge', props:{ x:540, y:860, text:'Order Now', color:'gold' } },
    ]},
  { num:38, name:'Poll Story', section:'Story', format:'story', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1920, fill:'cream' } },
      { type:'text', props:{ x:540, y:400, text:'THIS or THAT?', size:40, align:'center', font:'Playfair Display' } },
      { type:'rect', props:{ x:80, y:550, w:400, h:500, fill:'white' } },
      { type:'rect', props:{ x:600, y:550, w:400, h:500, fill:'white' } },
      { type:'text', props:{ x:280, y:1120, text:'Pasta', size:24, color:'terracotta', align:'center' } },
      { type:'text', props:{ x:800, y:1120, text:'Pizza', size:24, color:'olive', align:'center' } },
    ]},
  { num:39, name:'Menu Story', section:'Story', format:'story', bg:'cream',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1200, fill:'cream' } },
      { type:'rect', props:{ x:0, y:1200, w:1080, h:720, fill:'white' } },
      { type:'text', props:{ x:60, y:1260, text:'Caesar Salad', size:36, font:'Playfair Display' } },
      { type:'text', props:{ x:60, y:1330, text:'Romaine / Parmesan / Croutons', size:18 } },
      { type:'badge', props:{ x:60, y:1420, text:'$14', color:'gold' } },
    ]},
  { num:40, name:'Hours Story', section:'Story', format:'story', bg:'charcoal',
    elements:[
      { type:'rect', props:{ x:0, y:0, w:1080, h:1920, fill:'charcoal' } },
      { type:'text', props:{ x:540, y:700, text:'Open Today', size:48, color:'white', align:'center', font:'Playfair Display' } },
      { type:'text', props:{ x:540, y:790, text:'11:00 AM - 10:00 PM', size:28, color:'white', align:'center' } },
      { type:'text', props:{ x:540, y:850, text:'Kitchen closes at 9:30 PM', size:16, color:'white', align:'center' } },
      { type:'text', props:{ x:540, y:950, text:'See you soon!', size:22, color:'gold', align:'center' } },
    ]},
];

// Color name -> approximate RGB hex string for keyboard entry
const hexMap: Record<string, string> = {
  charcoal:   '1a1a1a',
  cream:      'faf6f0',
  terracotta: 'c8553d',
  olive:      '6b8f5e',
  gold:       'e8b84b',
  white:      'ffffff',
};

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function buildTemplate(tools: AffinityDesignerMCPTools, t: TemplateSpec) {
  const dim = DIMS[t.format];
  const dimLabel = `${dim.w}x${dim.h}`;
  const label = `#${String(t.num).padStart(2, '0')} ${t.name} [${t.section}]`;

  console.log(`  Building ${label} (${dimLabel})...`);

  // 1. Create new document
  const doc = await tools.executeTool('affinity_new_document', {
    width: dim.w, height: dim.h, units: 'px'
  });
  if (!doc.success) {
    console.log(`    FAIL doc creation: ${doc.error}`);
    return;
  }
  await delay(1500);

  // 2. Add background rectangle
  const bgColor = t.bg;
  for (const el of t.elements) {
    if (el.type === 'rect') {
      const r = el.props;
      // Create rectangle for this region
      // For full-bg rects, use the document bg color
      if (r.x === 0 && r.y === 0 && (r.w === dim.w || r.w === 1080 || r.w === 540) && (r.h === dim.h || r.h === 1080 || r.h === 1920 || r.h === 1350)) {
        await tools.executeTool('affinity_create_shape', {
          shape: 'rectangle',
          x: r.x + 50, y: r.y + 50,
          width: r.w - 100, height: r.h - 100
        });
        await delay(300);
      } else {
        await tools.executeTool('affinity_create_shape', {
          shape: 'rectangle',
          x: r.x, y: r.y,
          width: r.w, height: r.h
        });
        await delay(300);
      }
    } else if (el.type === 'circle') {
      const c = el.props;
      await tools.executeTool('affinity_create_shape', {
        shape: 'ellipse',
        x: c.cx - c.r, y: c.cy - c.r,
        width: c.r * 2, height: c.r * 2
      });
      await delay(300);
    }
  }
  await delay(800);

  // 3. Add text elements
  for (const el of t.elements) {
    if (el.type === 'text') {
      const r = el.props;
      const text = r.text || '';
      const fontSize = r.size || 24;
      const tx = r.align === 'center' ? Math.max(50, r.x - 300) : r.x;
      const ty = r.y;
      await tools.executeTool('affinity_add_text', {
        text: text,
        fontSize: fontSize,
        x: tx, y: ty,
      });
      await delay(400);
    } else if (el.type === 'badge') {
      const r = el.props;
      const bx = r.align === 'center' ? Math.max(100, r.x - 150) : r.x;
      const by = r.y;
      await tools.executeTool('affinity_create_shape', {
        shape: 'rectangle',
        x: bx, y: by,
        width: 300, height: 60
      });
      await delay(200);
      await tools.executeTool('affinity_add_text', {
        text: r.text || '',
        fontSize: 20,
        x: bx + 20, y: by + 12,
      });
      await delay(400);
    }
  }
  await delay(500);

  // 4. Export as PNG
  const pngPath = resolve(OUTPUT, `${String(t.num).padStart(2, '0')}-${t.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`);
  const exportResult = await tools.executeTool('affinity_export_document', {
    path: pngPath,
    format: 'png',
    quality: 100
  });
  console.log(`    Export: ${exportResult.success ? 'OK' : 'FAIL'}`);
  await delay(500);

  // 5. Save as .afdesign
  const afPath = resolve(OUTPUT, `${String(t.num).padStart(2, '0')}-${t.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.afdesign`);
  const saveResult = await tools.executeTool('affinity_save_document', {
    path: afPath
  });
  console.log(`    Save: ${saveResult.success ? 'OK' : 'FAIL'}`);
  await delay(500);

  // 6. Close document
  await tools.executeTool('affinity_close_document', {});
  await delay(1000);
}

async function main() {
  mkdirSync(OUTPUT, { recursive: true });

  const tools = new AffinityDesignerMCPTools();
  const init = await tools.initialize();
  console.log('Init:', init.success);

  if (!init.success) {
    console.error('Failed to initialize Affinity Designer tools');
    process.exit(1);
  }

  // Start the app
  const start = await tools.executeTool('affinity_start_app', {});
  console.log('Start app:', start.success ? 'OK' : 'FAIL - may already be running');

  // Wait for app to fully load
  console.log('Waiting for Affinity Designer to load...');
  await delay(8000);

  // Build each template
  for (const t of templates) {
    await buildTemplate(tools, t);
  }

  console.log('\n=== All 40 templates generated ===');
  console.log(`Output: ${OUTPUT}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
