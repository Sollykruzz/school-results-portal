import { WebsiteConfig, FacilityItem, GalleryItem } from '../types';
import { DEFAULT_CURRENT_SESSION } from '../utils/grading';
import { DEFAULT_SCHOOL_CONFIG } from '../config/schoolConfig';

export const DEFAULT_GALLERY_PRESETS: GalleryItem[] = [
  {
    id: 'gal_1',
    title: 'Modern ICT & Digital Literacy Lab',
    category: 'STEM & ICT',
    caption: 'Students developing computer literacy, coding basics, and digital confidence.',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
    date: `${DEFAULT_CURRENT_SESSION} Session`,
    order: 1
  },
  {
    id: 'gal_2',
    title: 'Integrated Science Practicals',
    category: 'Academics',
    caption: 'Practical experimentation in biology, chemistry, and physics under expert guidance.',
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1200&auto=format&fit=crop',
    date: `${DEFAULT_CURRENT_SESSION} Session`,
    order: 2
  },
  {
    id: 'gal_3',
    title: 'Standard Library & Quiet Study Pods',
    category: 'Academics',
    caption: 'Fostering deep reading, research curiosity, and quiet scholarly study.',
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=1200&auto=format&fit=crop',
    date: `${DEFAULT_CURRENT_SESSION} Session`,
    order: 3
  },
  {
    id: 'gal_4',
    title: 'Interactive Smart Classroom Engagement',
    category: 'Academics',
    caption: 'Active learner participation with modern instructional whiteboards and caring educators.',
    imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1200&auto=format&fit=crop',
    date: `${DEFAULT_CURRENT_SESSION} Session`,
    order: 4
  },
  {
    id: 'gal_5',
    title: 'Multi-Sport Athletics & Outdoor Fitness',
    category: 'Sports',
    caption: 'Instilling sportsmanship, physical agility, and team camaraderie on campus.',
    imageUrl: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1200&auto=format&fit=crop',
    date: `${DEFAULT_CURRENT_SESSION} Session`,
    order: 5
  },
  {
    id: 'gal_6',
    title: 'Early Years Montessori Discovery & Play',
    category: 'Early Years',
    caption: 'Nurturing foundational motor coordination, phonics blending, and sensory discovery.',
    imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?q=80&w=1200&auto=format&fit=crop',
    date: `${DEFAULT_CURRENT_SESSION} Session`,
    order: 6
  }
];

export const DEFAULT_FACILITY_PRESETS = [
  {
    title: 'Modern ICT & Computer Lab',
    category: 'STEM & Tech' as const,
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
    description: 'High-speed networked computer workstations equipped with coding tools, typing tutors, and modern digital literacy curriculum.',
    features: ['High-Speed Fiber Network', 'Individual Student PCs', 'Coding & Robotics Prep', 'Digital Projector Systems']
  },
  {
    title: 'Integrated Science Laboratory',
    category: 'STEM & Tech' as const,
    imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1200&auto=format&fit=crop',
    description: 'Fully equipped hands-on laboratory with safety equipment, microscopes, and chemical/biological testing stations.',
    features: ['Physics & Chemistry Stations', 'Safety Showers & Goggles', 'Digital Microscopes', 'Practical Exam Prep']
  },
  {
    title: 'Standard Library & Study Hub',
    category: 'Academics' as const,
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=1200&auto=format&fit=crop',
    description: 'A rich repository of academic curriculum textbooks, reference encyclopedias, literature, and quiet study alcoves.',
    features: ['Over 3,000 Volume Library', 'Quiet Study Pods', 'Research Reference Area', 'Literature & Reading Club']
  },
  {
    title: 'Bright, Ventilated Smart Classrooms',
    category: 'Academics' as const,
    imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1200&auto=format&fit=crop',
    description: 'Ergonomic student desks, ample natural lighting, cross-ventilation, and modern interactive whiteboards.',
    features: ['Ergonomic Seating', 'Maximum 25 Pupils/Class', 'Interactive Whiteboards', 'Continuous Power Supply']
  },
  {
    title: 'Multi-Sport Turf & Athletic Arena',
    category: 'Sports' as const,
    imageUrl: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1200&auto=format&fit=crop',
    description: 'Spacious sports grounds catering to football, track & field, volleyball, basketball, and physical fitness development.',
    features: ['Standard Football Field', 'Sprint Running Tracks', 'Basketball / Volleyball Courts', 'Inter-House Sports Ready']
  },
  {
    title: 'Safe Air-Conditioned School Transit',
    category: 'Safety & Transit' as const,
    imageUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?q=80&w=1200&auto=format&fit=crop',
    description: 'Modern, well-maintained bus fleet covering major transit routes and surrounding environs with dedicated child chaperones and safety protocols.',
    features: ['Dedicated Route Drivers', 'Trained Child Chaperones', 'First-Aid Equipped', 'Punctual Doorstep Logistics']
  },
  {
    title: '24/7 Solar Backup & Clean Water Filtration',
    category: 'Campus' as const,
    imageUrl: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?q=80&w=1200&auto=format&fit=crop',
    description: 'Uninterrupted power supply via solar-inverter systems and heavy-duty generators, backed by industrial borehole water purification.',
    features: ['Zero Learning Downtime', 'Purified Drinking Water', 'Clean Hygiene Facilities', 'Fully Fenced Gated Security']
  },
  {
    title: 'Early Years Montessori Discovery Suite',
    category: 'Early Years' as const,
    imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?q=80&w=1200&auto=format&fit=crop',
    description: 'Vibrant, foam-padded sensory learning environment fostering early phonics, cognitive stimulation, and motor coordination.',
    features: ['Child-Safe Montessori Toys', 'Indoor Soft Play Area', 'Phonics Audio-Visual Center', 'Loving Infant Caregivers']
  }
];

export const DEFAULT_WEBSITE_CONFIG: WebsiteConfig = {
  schoolName: DEFAULT_SCHOOL_CONFIG.schoolName,
  shortName: DEFAULT_SCHOOL_CONFIG.shortName,
  acronym: DEFAULT_SCHOOL_CONFIG.acronym,
  motto: DEFAULT_SCHOOL_CONFIG.motto,
  subMotto: DEFAULT_SCHOOL_CONFIG.subMotto,
  logoUrl: DEFAULT_SCHOOL_CONFIG.logoUrl,
  stampLogoUrl: DEFAULT_SCHOOL_CONFIG.stampLogoUrl || '',
  stampTopText: DEFAULT_SCHOOL_CONFIG.stampTopText,
  stampBottomText: DEFAULT_SCHOOL_CONFIG.stampBottomText,
  principalName: DEFAULT_SCHOOL_CONFIG.principalName,
  principalTitle: DEFAULT_SCHOOL_CONFIG.principalTitle,
  country: DEFAULT_SCHOOL_CONFIG.country,
  portalTitle: DEFAULT_SCHOOL_CONFIG.portalTitle,
  welcomeHeadline: DEFAULT_SCHOOL_CONFIG.welcomeHeadline,
  welcomeSubheadline: DEFAULT_SCHOOL_CONFIG.welcomeSubheadline,
  aboutText: DEFAULT_SCHOOL_CONFIG.aboutText,
  campusAddress: DEFAULT_SCHOOL_CONFIG.campusAddress,
  cityState: DEFAULT_SCHOOL_CONFIG.cityState,
  phonePrimary: DEFAULT_SCHOOL_CONFIG.phonePrimary,
  phoneSecondary: DEFAULT_SCHOOL_CONFIG.phoneSecondary,
  emailContact: DEFAULT_SCHOOL_CONFIG.emailContact,
  whatsAppNumber: DEFAULT_SCHOOL_CONFIG.whatsAppNumber,
  visitingHours: DEFAULT_SCHOOL_CONFIG.visitingHours,
  admissionStatus: `Admissions Ongoing for ${DEFAULT_CURRENT_SESSION} Academic Session`,
  facilities: DEFAULT_FACILITY_PRESETS.map((f, i) => ({
    id: `fac_${i + 1}`,
    title: f.title,
    category: f.category,
    description: f.description,
    imageUrl: f.imageUrl,
    features: f.features,
    order: i + 1,
    highlight: i === 0 || i === 1 || i === 4
  })),
  enableFacilities: false,
  gallery: DEFAULT_GALLERY_PRESETS,
  enableGallery: true,
  programmes: [
    {
      id: 'prog_ey',
      name: 'Early Years & Montessori',
      ageGroup: '1.5 – 5 Years',
      classes: 'KG 1 - 2, Nursery 1 - 2',
      description: 'Foundational literacy, numeracy, phonics blending, social socialization, and sensory discovery in a warm, loving atmosphere.',
      highlights: ['Jolly Phonics Foundation', 'Sensory & Motor Discovery', 'Nurturing Caregivers', 'Safe Play Facilities'],
      colorTheme: 'blue'
    },
    {
      id: 'prog_primary',
      name: 'Basic Education (Primary)',
      ageGroup: '5 – 11 Years',
      classes: 'Primary 1 to Primary 6',
      description: 'Rigorous national curriculum enriched with computer coding, French, creative writing, science discovery, and continuous assessment tracking.',
      highlights: ['National Common Entrance Prep', 'Computer & Coding Classes', 'Moral & Civic Instruction', 'Weekly Continuous Assessment'],
      colorTheme: 'red'
    },
    {
      id: 'prog_jss',
      name: 'Junior Secondary School',
      ageGroup: '11 – 14 Years',
      classes: 'JSS 1 to JSS 3',
      description: 'Comprehensive foundational secondary education transitioning learners smoothly into science, technical, and humanities disciplines.',
      highlights: ['BECE / Junior WAEC Excellence', 'Practical Science Labs', 'Introductory Technology', 'Public Speaking & Debate'],
      colorTheme: 'blue'
    },
    {
      id: 'prog_ss',
      name: 'Senior Secondary School',
      ageGroup: '14 – 17 Years',
      classes: 'SS 1 to SS 3',
      description: 'Specialized Science, Arts, and Commercial streams with targeted tutoring for SSCE, WAEC, NECO, and JAMB UTME distinction.',
      highlights: ['Science, Arts & Commercial Streams', 'Intensive WAEC / JAMB Masterclasses', 'Career Mentorship', 'Leadership & Prefect Guild'],
      colorTheme: 'red'
    }
  ],
  values: [
    {
      id: 'val_knowledge',
      title: 'Academic Distinction',
      shortDesc: 'Relentless pursuit of intellectual mastery.',
      description: 'We believe every child possesses innate genius that flourishes under caring, systematic instruction and hands-on discovery.'
    },
    {
      id: 'val_discipline',
      title: 'Moral Integrity & Discipline',
      shortDesc: 'Character that outshines talent.',
      description: 'Knowledge without discipline is hollow. We cultivate honesty, punctuality, reverence, and self-restraint as non-negotiable core pillars.'
    },
    {
      id: 'val_success',
      title: 'Achievement & Leadership',
      shortDesc: 'Preparing global problem solvers.',
      description: 'Equipping pupils with public speaking confidence, digital competence, and emotional resilience to excel anywhere in the world.'
    },
    {
      id: 'val_safety',
      title: 'Secure & Caring Community',
      shortDesc: 'Safety, love, and individual attention.',
      description: 'A clean, gated, and supervised campus where parents have peace of mind knowing their children are loved and protected.'
    }
  ],
  announcements: [
    {
      id: 'ann_1',
      title: 'Admissions Open for All Classes (Crèche to SSS 3)',
      date: 'Active Session',
      category: 'Admissions',
      summary: 'Entrance examinations and admission screenings are conducted weekly at the school campus. Pick up forms at the administrative office or register an online enquiry.',
      urgent: true
    },
    {
      id: 'ann_2',
      title: 'Online Real-Time Continuous Assessment Portal',
      date: 'Termly Update',
      category: 'Academic Portal',
      summary: 'Parents and guardians can now check end-of-term results and download official stamped report sheets directly from our student portal.',
      urgent: false
    }
  ],
  adminSecretCode: 'admin123',
  lastPublishedAt: new Date().toISOString(),
  lastPublishedBy: 'Administrator'
};
