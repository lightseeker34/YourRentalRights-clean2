import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, HelpCircle, GripVertical, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  page: string;
  requiresCase?: boolean;
  noCaseContent?: string;
  noCaseTarget?: string;
  mobilePosition?: "top" | "bottom"; // Force position on mobile
  mobileHint?: string; // Show a hint/instruction on mobile
  mobileTarget?: string; // Alternative target for mobile
  mobileOffset?: { top?: number }; // Fine-tune vertical position on mobile
  desktopOffset?: { top?: number; left?: number }; // Fine-tune position on desktop
  desktopPosition?: "bottom-right"; // Force specific position on desktop
}

const ALL_TOUR_STEPS: TourStep[] = [
  // Dashboard Steps
  {
    page: "/dashboard",
    target: '[data-testid="add-new-log-button-desktop"]',
    title: "Create Your First Incident",
    content: "Click here to start documenting an issue with your landlord. Give it a clear title like 'Broken Heater' or 'Mold in Bathroom'. Each entry becomes your evidence file.",
    placement: "bottom",
    mobileTarget: '[data-testid="add-new-log-button"]',
  },
  {
    page: "/dashboard",
    target: '[data-testid^="incident-card-bubble-"]',
    title: "Your Case Timeline",
    content: "Each card represents a case you're tracking. You can see the status (Open/Closed) and recent activity at a glance.",
    placement: "right",
    requiresCase: true,
    noCaseTarget: '[data-testid="add-new-log-button-desktop"]',
    mobileTarget: '[data-testid="add-new-log-button"]',
    noCaseContent: "Once you create a case using this button, it will appear here as a card. You'll be able to see the status and recent activity at a glance.",
  },
  {
    page: "/dashboard",
    target: '[data-testid^="incident-card-bubble-"]',
    title: "Let's Go Inside a Case",
    content: "Now let's explore what's inside a case - including the AI assistant that can help analyze your situation.",
    placement: "right",
    requiresCase: true,
    noCaseTarget: '[data-testid="add-new-log-button-desktop"]',
    mobileTarget: '[data-testid="add-new-log-button"]',
    noCaseContent: "Create your first case using this button, then come back to the tour to explore the AI assistant and other features inside a case!",
  },
  // Incident View Steps — sidebar steps first, then chat steps
  {
    page: "/dashboard/incident",
    target: '[data-testid="status-toggle"]',
    title: "Track Your Progress",
    content: "Toggle between Open and Closed to track your case. Keep it Open while you're still working on the issue.",
    placement: "bottom",
    mobilePosition: "bottom",
    mobileHint: "Swipe from the left edge to open the side panel",
    mobileTarget: '[data-testid="status-toggle-mobile"]',
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="button-edit-incident"]',
    title: "Edit Case & Upload Evidence",
    content: "Click the edit button to update your case details and upload photos, documents, or entire folders as evidence. Everything is timestamped and stored securely.",
    placement: "left",
    mobileTarget: '[data-testid="button-edit-incident-mobile"]',
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="log-buttons"]',
    title: "Record Your Interactions",
    content: "Record every call, text, email, or service request with your landlord or property manager. Each log is timestamped and you can attach photos or documents as proof. This builds your evidence timeline.",
    placement: "right",
    mobileTarget: '[data-testid="log-buttons-mobile"]',
    mobilePosition: "top",
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="button-export-pdf-desktop"]',
    title: "Export Your Case as PDF",
    content: "Download a complete PDF report of your case, including all evidence, photos, and communication logs. Perfect for sharing with a lawyer or filing a complaint.",
    placement: "left",
    mobileTarget: '[data-testid="button-export-pdf"]',
    mobilePosition: "bottom",
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="button-ai-analysis-desktop"]',
    title: "AI Case Analysis",
    content: "Let the AI review your entire case for litigation potential. It checks housing codes, landlord response patterns, and evidence strength to give you a detailed assessment.",
    placement: "left",
    mobileTarget: '[data-testid="button-ai-analysis"]',
    mobilePosition: "bottom",
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="input-chat-message"]',
    title: "Your AI Assistant",
    content: "This is where you chat with your personal AI assistant! Ask questions like 'What are my rights as a tenant?' or 'Can you help me write a letter to my landlord?'",
    placement: "top",
    mobilePosition: "bottom",
    mobileOffset: { top: -120 },
    desktopOffset: { top: -60 },
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="button-send-chat"]',
    title: "Get Instant Help",
    content: "The AI knows about housing laws and your specific case. It can analyze your evidence and help you draft professional letters.",
    placement: "left",
    mobilePosition: "bottom",
    mobileOffset: { top: -120 },
  },
  {
    page: "/dashboard/incident",
    target: '[data-testid="button-plus-menu"]',
    title: "Attach Files to Chat",
    content: "Use the + button to upload files, folders, or attach existing evidence to your messages. The AI can analyze images to help identify issues like mold or water damage.",
    placement: "top",
    desktopOffset: { top: -40 },
    mobilePosition: "bottom",
    mobileOffset: { top: -120 },
  },
  // Forum Steps
  {
    page: "/forum",
    target: '[data-testid^="category-card-"]',
    title: "Welcome to the Community",
    content: "Connect with other tenants facing similar issues. Browse categories to find discussions about your specific situation.",
    placement: "right",
  },
  {
    page: "/forum",
    target: '[data-testid="new-discussion-btn"]',
    title: "Start a Discussion",
    content: "Have a question or want to share your experience? Create a new post to get advice from the community.",
    placement: "bottom",
  },
  {
    page: "/forum",
    target: '[data-testid="search-forum"]',
    title: "Search the Community",
    content: "Looking for something specific? Search through posts to find discussions about topics like security deposits or lease issues.",
    placement: "bottom",
  },
  {
    page: "/forum",
    target: '[data-testid="my-posts-link"]',
    title: "Your Posts",
    content: "Keep track of your discussions and see replies to your questions here.",
    placement: "left",
  },
  // Profile Steps
  {
    page: "/profile",
    target: '[data-testid="profile-rental-section"]',
    title: "Your Rental Information",
    content: "Add your address and rental details here. This information helps the AI assistant give you more accurate advice.",
    placement: "right",
  },
  {
    page: "/profile",
    target: '[data-testid="profile-landlord-section"]',
    title: "Property Manager Details",
    content: "Enter your landlord or property manager's contact info. This is used when generating demand letters.",
    placement: "right",
  },
  {
    page: "/profile",
    target: '[data-testid="profile-lease-upload"]',
    title: "Upload Your Lease",
    content: "Upload your lease document for reference. The AI can analyze it to help identify if your landlord is violating any terms.",
    placement: "right",
    desktopPosition: "bottom-right",
    desktopOffset: { top: -50 },
  },
  {
    page: "/profile",
    target: '[data-testid="profile-forum-section"]',
    title: "Forum Profile",
    content: "Customize how you appear in the community forum. Use an alternative to your real name to protect your identity.\n\nClick Finish to start using the app!",
    placement: "right",
    mobilePosition: "bottom",
  },
];

function getPageFromPath(pathname: string): string {
  if (pathname.startsWith("/dashboard/incident")) return "/dashboard/incident";
  if (pathname === "/dashboard") return "/dashboard";
  if (pathname.startsWith("/forum")) return "/forum";
  if (pathname === "/profile") return "/profile";
  return pathname;
}

const TOUR_STORAGE_KEY = "unified_tour_state";
const TOUR_COMPLETED_KEY = "unified_tour_completed";
const INCIDENT_PATH_KEY = "tour_incident_path";

interface TourState {
  globalStepIndex: number;
  isActive: boolean;
}

function saveTourState(state: TourState) {
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
}

function loadTourState(): TourState | null {
  const saved = localStorage.getItem(TOUR_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

function clearTourState() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  localStorage.removeItem(INCIDENT_PATH_KEY);
}

export function GuidedTour() {
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [globalStep, setGlobalStep] = useState(0);
  const [visibleStep, setVisibleStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasCase, setHasCase] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  // Displayed rect only updates when content is invisible (during transition)
  const [displayedSpotlightRect, setDisplayedSpotlightRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [displayedTooltipPos, setDisplayedTooltipPos] = useState<{top: string, left: string, width?: string, transform?: string} | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [desktopTooltipHeight, setDesktopTooltipHeight] = useState(220);
  const TOUR_FADE_MS = 260;
  const TOUR_SETTLE_MS = 120;

  const currentPage = getPageFromPath(location);
  const activeStepData = ALL_TOUR_STEPS[globalStep];
  const visibleStepData = ALL_TOUR_STEPS[visibleStep];
  const expectedPage = activeStepData?.page || "/dashboard";
  const totalSteps = ALL_TOUR_STEPS.length;

  const queryVisibleElement = useCallback((selector: string): Element | null => {
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) return null;

    const visible = elements.find((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    });

    return visible || elements[0] || null;
  }, []);

  // Check if user has any cases
  useEffect(() => {
    const checkForCases = () => {
      const incidentCard = document.querySelector('[data-testid^="incident-card-"]');
      setHasCase(!!incidentCard);
    };
    checkForCases();
    const interval = setInterval(checkForCases, 1000);
    return () => clearInterval(interval);
  }, [currentPage]);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (completed) return;

    const savedState = loadTourState();
    if (savedState?.isActive) {
      setGlobalStep(savedState.globalStepIndex);
      setVisibleStep(savedState.globalStepIndex);
      setIsOpen(true);
    } else if (!savedState) {
      if (currentPage === "/dashboard") {
        const timer = setTimeout(() => {
          setIsOpen(true);
          saveTourState({ globalStepIndex: 0, isActive: true });
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentPage]);

  useEffect(() => {
    if (!isOpen || !activeStepData) return;

    if (expectedPage !== currentPage && !isNavigating) {
      setIsNavigating(true);
      
      if (expectedPage === "/dashboard/incident") {
        const savedPath = localStorage.getItem(INCIDENT_PATH_KEY);
        if (savedPath) {
          navigate(savedPath);
        } else {
          const incidentCard = queryVisibleElement('[data-testid^="incident-card-"]');
          if (incidentCard) {
            const link = incidentCard.querySelector("a");
            if (link instanceof HTMLAnchorElement) {
              const href = link.getAttribute("href");
              if (href) {
                localStorage.setItem(INCIDENT_PATH_KEY, href);
                navigate(href);
              }
            }
          } else {
            const incidentStepsCount = ALL_TOUR_STEPS.filter(s => s.page === "/dashboard/incident").length;
            const newStep = globalStep + incidentStepsCount;
            setGlobalStep(newStep);
            saveTourState({ globalStepIndex: newStep, isActive: true });
            setIsNavigating(false);
          }
        }
      } else {
        navigate(expectedPage);
      }
      
      const timer = setTimeout(() => setIsNavigating(false), 500);
      return () => clearTimeout(timer);
    } else if (expectedPage === currentPage) {
      setIsNavigating(false);
    }
  }, [isOpen, expectedPage, currentPage, navigate, globalStep, activeStepData, isNavigating]);

  // Get the actual target selector to use (fallback to noCaseTarget if no cases, or mobileTarget on mobile)
  const getActiveTarget = useCallback(() => {
    if (!activeStepData) return null;
    if (!hasCase && activeStepData.requiresCase && activeStepData.noCaseTarget) {
      return activeStepData.noCaseTarget;
    }
    // Use mobile target on mobile devices if available
    const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileDevice && activeStepData.mobileTarget) {
      return activeStepData.mobileTarget;
    }
    return activeStepData.target;
  }, [activeStepData, hasCase]);

  // Check if element is visible in viewport
  const isElementInViewport = useCallback((rect: DOMRect) => {
    const margin = 100;
    return (
      rect.top >= margin &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight - margin &&
      rect.right <= window.innerWidth
    );
  }, []);

  // Scroll to target and wait for completion
  const scrollToTarget = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const targetSelector = getActiveTarget();
      if (!targetSelector) {
        resolve();
        return;
      }
      const target = queryVisibleElement(targetSelector);
      if (!target) {
        resolve();
        return;
      }

      const rect = target.getBoundingClientRect();

      // Skip scroll if already visible
      if (isElementInViewport(rect)) {
        resolve();
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

      // Wait until movement has actually settled (works for window scroll + nested container scroll)
      const start = performance.now();
      let lastScrollY = window.scrollY;
      let lastTop: number | null = null;
      let lastLeft: number | null = null;
      let stableFrames = 0;

      const checkSettled = () => {
        const elapsed = performance.now() - start;
        const currentTarget = queryVisibleElement(targetSelector);
        const currentRect = currentTarget?.getBoundingClientRect();

        // Loose in-view check to avoid waiting forever on strict margins
        const inViewLoose = !!currentRect &&
          currentRect.top >= 20 &&
          currentRect.left >= 0 &&
          currentRect.bottom <= window.innerHeight - 20 &&
          currentRect.right <= window.innerWidth;

        const deltaY = Math.abs(window.scrollY - lastScrollY);
        lastScrollY = window.scrollY;

        // Track element motion directly so we catch nested scrolling/layout movement
        let deltaTop = 0;
        let deltaLeft = 0;
        if (currentRect) {
          if (lastTop !== null) deltaTop = Math.abs(currentRect.top - lastTop);
          if (lastLeft !== null) deltaLeft = Math.abs(currentRect.left - lastLeft);
          lastTop = currentRect.top;
          lastLeft = currentRect.left;
        }

        // consider settled only when both page and target rect are stable for several frames
        if (deltaY < 0.75 && deltaTop < 0.75 && deltaLeft < 0.75) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }

        // finish quickly and consistently once stable; don't force strict viewport match
        if ((stableFrames >= 8 && (inViewLoose || elapsed > 450)) || elapsed > 1400) {
          resolve();
          return;
        }

        requestAnimationFrame(checkSettled);
      };

      requestAnimationFrame(checkSettled);
    });
  }, [getActiveTarget, isElementInViewport, queryVisibleElement]);

  // Compute and return the current target positions (does not set state)
  const computeTargetPositions = useCallback(() => {
    const targetSelector = getActiveTarget();
    if (!targetSelector) return null;
    
    const target = queryVisibleElement(targetSelector);
    if (!target) return null;
    
    const rect = target.getBoundingClientRect();
    const SPOTLIGHT_PADDING = 5;
    const spotlight = {
      x: rect.left - SPOTLIGHT_PADDING,
      y: rect.top - SPOTLIGHT_PADDING,
      width: rect.width + SPOTLIGHT_PADDING * 2,
      height: rect.height + SPOTLIGHT_PADDING * 2
    };
    
    return { rect, spotlight };
  }, [getActiveTarget, queryVisibleElement]);

  const updateTargetRect = useCallback(() => {
    if (!isOpen || !activeStepData || expectedPage !== currentPage || isNavigating) {
      setTargetRect(null);
      setSpotlightRect(null);
      return;
    }
    const positions = computeTargetPositions();
    if (positions) {
      setTargetRect(positions.rect);
      setSpotlightRect(positions.spotlight);
    } else {
      setTargetRect(null);
      setSpotlightRect(null);
    }
  }, [isOpen, activeStepData, expectedPage, currentPage, isNavigating, computeTargetPositions]);

  // Compute tooltip position - accepts optional rect to use instead of state
  const computeTooltipPosition = useCallback((rectOverride?: DOMRect | null, desktopHeightOverride?: number) => {
    const rect = rectOverride !== undefined ? rectOverride : targetRect;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20;
    const mobile = viewportWidth < 768;
    const tooltipWidth = mobile ? Math.min(320, viewportWidth - 40) : 340;
    // Use measured height on desktop so the tooltip aligns with each step's content
    const tooltipHeight = mobile ? 300 : (desktopHeightOverride ?? desktopTooltipHeight);

    if (mobile) {
      const horizontalCenter = (viewportWidth - tooltipWidth) / 2;
      let top = padding;
      
      if (visibleStepData?.mobilePosition === "bottom") {
        top = viewportHeight - tooltipHeight - padding - 95;
      } else if (visibleStepData?.mobilePosition === "top") {
        top = padding + 60;
      } else if (rect) {
        const targetCenter = rect.top + rect.height / 2;
        if (targetCenter < viewportHeight / 2) {
          top = Math.min(rect.bottom + padding, viewportHeight - tooltipHeight - padding);
        } else {
          top = Math.max(padding, rect.top - tooltipHeight - padding);
        }
      } else {
        top = (viewportHeight - tooltipHeight) / 2;
      }
      
      if (visibleStepData?.mobileOffset?.top) {
        top += visibleStepData.mobileOffset.top;
      }
      
      // Always clamp on mobile to ensure tooltip stays on screen
      // Use a minimum of 75px from top and bottom
      const minTop = 75;
      const maxTop = Math.max(minTop, viewportHeight - tooltipHeight - 75);
      top = Math.max(minTop, Math.min(top, maxTop));
      
      // Ensure left is also clamped
      const left = Math.max(padding, Math.min(horizontalCenter, viewportWidth - tooltipWidth - padding));
      
      return { top: `${top}px`, left: `${left}px`, width: `${tooltipWidth}px` };
    }

    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    let preferredPlacement = visibleStepData?.placement || "bottom";
    
    const canFit = {
      top: spaceTop >= tooltipHeight + padding,
      bottom: spaceBottom >= tooltipHeight + padding,
      left: spaceLeft >= tooltipWidth + padding,
      right: spaceRight >= tooltipWidth + padding,
    };

    if (!canFit[preferredPlacement]) {
      if (preferredPlacement === "left" || preferredPlacement === "right") {
        if (canFit.right) preferredPlacement = "right";
        else if (canFit.left) preferredPlacement = "left";
        else if (canFit.bottom) preferredPlacement = "bottom";
        else if (canFit.top) preferredPlacement = "top";
      } else {
        if (canFit.bottom) preferredPlacement = "bottom";
        else if (canFit.top) preferredPlacement = "top";
        else if (canFit.right) preferredPlacement = "right";
        else if (canFit.left) preferredPlacement = "left";
      }
    }

    let top = 0;
    let left = 0;

    switch (preferredPlacement) {
      case "top":
        top = rect.top - tooltipHeight - padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
        break;
    }

    left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));

    // Keep desktop tooltip adjacent to the spotlight target (no secondary reposition pass).
    // We only clamp to viewport bounds, but do not jump above/below for overlap handling.

    // Ignore special detached desktop placement; keep everything adjacent on desktop.


    if (visibleStepData?.desktopOffset) {
      if (visibleStepData.desktopOffset.top) top += visibleStepData.desktopOffset.top;
      if (visibleStepData.desktopOffset.left) left += visibleStepData.desktopOffset.left;
    }

    // Final clamp - always ensure tooltip stays within viewport
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipHeight - padding));

    return { top: `${top}px`, left: `${left}px` };
  }, [visibleStepData, targetRect, desktopTooltipHeight]);

  // Step transition: fade out -> scroll -> update displayed position -> fade in
  useEffect(() => {
    if (!isOpen || !activeStepData) return;
    
    let cancelled = false;
    
    const performTransition = async () => {
      // Fade out
      setIsTransitioning(true);
      
      // Wait for fade out to fully complete before any repositioning work
      await new Promise(r => setTimeout(r, TOUR_FADE_MS + 30));
      if (cancelled) return;
      
      // Scroll to target if needed (content is completely invisible now)
      await scrollToTarget();
      if (cancelled) return;
      
      // Small settle delay after scroll before measuring final target position
      await new Promise(r => setTimeout(r, TOUR_SETTLE_MS));
      if (cancelled) return;
      
      // Now compute the final positions DIRECTLY (not from state)
      // Retry a few times if target not found (e.g. drawer still animating open/closed)
      let positions = computeTargetPositions();
      if (!positions) {
        for (let i = 0; i < 4; i++) {
          await new Promise(r => setTimeout(r, 200));
          if (cancelled) return;
          positions = computeTargetPositions();
          if (positions) break;
        }
      }
      if (cancelled) return;
      
      if (positions) {
        // Update target + spotlight while hidden
        setTargetRect(positions.rect);
        setSpotlightRect(positions.spotlight);
        setDisplayedSpotlightRect(positions.spotlight);

        // Switch step content while fully hidden
        setVisibleStep(globalStep);

        // Wait a frame so tooltip content/layout for the new step is committed
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (cancelled) return;

        // Measure real tooltip height for the new step before computing position
        let measuredDesktopHeight = desktopTooltipHeight;
        if (typeof window !== "undefined" && window.innerWidth >= 768 && tooltipRef.current) {
          const measured = tooltipRef.current.getBoundingClientRect().height;
          if (measured > 0) {
            measuredDesktopHeight = measured;
            setDesktopTooltipHeight(measured);
          }
        }

        const tooltipPosition = computeTooltipPosition(positions.rect, measuredDesktopHeight);
        setDisplayedTooltipPos(tooltipPosition);
      } else {
        // Still update visible content while hidden
        setVisibleStep(globalStep);
      }

      // Keep everything hidden briefly after reposition to avoid any visible intermediate frame
      await new Promise(r => setTimeout(r, TOUR_SETTLE_MS));
      if (cancelled) return;
      
      // Fade in
      setIsTransitioning(false);
    };
    
    performTransition();
    
    return () => { cancelled = true; };
    // Note: computeTooltipPosition excluded from deps - we pass rect directly, avoiding stale closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalStep, isOpen, activeStepData, scrollToTarget, computeTargetPositions]);

  // Handle resize - update positions immediately (no animation needed)
  useEffect(() => {
    const handleResize = () => {
      const positions = computeTargetPositions();
      if (positions) {
        setTargetRect(positions.rect);
        setSpotlightRect(positions.spotlight);
        setDisplayedSpotlightRect(positions.spotlight);
        // Also compute and update tooltip position atomically
        const tooltipPosition = computeTooltipPosition(positions.rect);
        setDisplayedTooltipPos(tooltipPosition);
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [computeTargetPositions, computeTooltipPosition]);

  const handleNext = () => {
    if (isTransitioning) return;
    if (globalStep < totalSteps - 1) {
      const newStep = globalStep + 1;
      setGlobalStep(newStep);
      saveTourState({ globalStepIndex: newStep, isActive: true });
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (isTransitioning) return;
    if (globalStep > 0) {
      const newStep = globalStep - 1;
      setGlobalStep(newStep);
      saveTourState({ globalStepIndex: newStep, isActive: true });
    }
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    clearTourState();
    setIsOpen(false);
    setGlobalStep(0);
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    clearTourState();
    setIsOpen(false);
    setGlobalStep(0);
  };

  const handleGoToStep = (stepIndex: number) => {
    if (isTransitioning) return;
    if (stepIndex >= 0 && stepIndex < totalSteps) {
      setGlobalStep(stepIndex);
      saveTourState({ globalStepIndex: stepIndex, isActive: true });
    }
  };

  const restartTour = () => {
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    clearTourState();
    
    // Find the first step for the current page
    let startStep = 0;
    const currentBasePath = currentPage.startsWith("/dashboard/incident") 
      ? "/dashboard/incident" 
      : currentPage;
    
    const pageStepIndex = ALL_TOUR_STEPS.findIndex(step => {
      if (step.page === "/dashboard/incident") {
        return currentPage.startsWith("/dashboard/incident");
      }
      return step.page === currentBasePath;
    });
    
    if (pageStepIndex !== -1) {
      // Found steps for current page, start there
      startStep = pageStepIndex;
      setGlobalStep(startStep);
      setVisibleStep(startStep);
      saveTourState({ globalStepIndex: startStep, isActive: true });
      setTimeout(() => setIsOpen(true), 100);
    } else {
      // No steps for current page, go to dashboard
      setGlobalStep(0);
      setVisibleStep(0);
      saveTourState({ globalStepIndex: 0, isActive: true });
      if (currentPage !== "/dashboard") {
        navigate("/dashboard");
      }
      setTimeout(() => setIsOpen(true), 100);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Measure desktop tooltip height so placement stays aligned with each step's content length
  useEffect(() => {
    if (!isOpen || isMobile || !tooltipRef.current) return;

    const element = tooltipRef.current;

    const updateHeight = () => {
      const measured = element.getBoundingClientRect().height;
      if (measured > 0) {
        setDesktopTooltipHeight(measured);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [isOpen, isMobile, globalStep]);

  // Calculate tooltip position using current state (for initial/fallback rendering only)
  const tooltipPos = computeTooltipPosition();
  
  // Initialize displayed positions on first render only (when tour opens)
  // Use a ref to track initialization so we don't depend on tooltipPos which changes every render
  const initializedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !isTransitioning && !initializedRef.current && spotlightRect) {
      setDisplayedSpotlightRect(spotlightRect);
      const initialTooltipPos = computeTooltipPosition();
      if (initialTooltipPos) {
        setDisplayedTooltipPos(initialTooltipPos);
      }
      initializedRef.current = true;
    }
    // Reset when tour closes
    if (!isOpen) {
      initializedRef.current = false;
    }
  }, [isOpen, spotlightRect, isTransitioning, computeTooltipPosition]);
  
  // Use frozen displayed positions for rendering so there is no visible motion during step transitions
  const renderSpotlight = displayedSpotlightRect;
  const renderTooltipPos = displayedTooltipPos || { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={restartTour}
        className="fixed bottom-32 right-4 z-40 gap-2 shadow-lg bg-white border-0 hover:border-0"
        data-testid="restart-tour-button"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Help Tour</span>
      </Button>
    );
  }

  if (!activeStepData || !visibleStepData || isNavigating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-2xl p-6 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Loading next step...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9998] pointer-events-none" data-testid="guided-tour-overlay">
        {/* Keep backdrop stable; hide spotlight cutout during transitions to prevent visible movement artifacts */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 9998 }}
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {!isTransitioning && renderSpotlight && (
                <rect 
                  x={renderSpotlight.x} 
                  y={renderSpotlight.y} 
                  width={renderSpotlight.width} 
                  height={renderSpotlight.height} 
                  rx="12" 
                  ry="12" 
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            fill="rgba(0, 0, 0, 0.6)" 
            mask="url(#spotlight-mask)" 
          />
        </svg>
        
        {/* Highlight ring - fades in/out with transitions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isTransitioning ? 0 : 1 }}
          transition={{ duration: TOUR_FADE_MS / 1000 }}
          style={{ zIndex: 9998 }}
        >
          {renderSpotlight && (
            <div
              className="absolute rounded-xl pointer-events-none"
              style={{
                top: renderSpotlight.y,
                left: renderSpotlight.x,
                width: renderSpotlight.width,
                height: renderSpotlight.height,
                border: '3px solid rgba(59, 130, 246, 0.8)',
                boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2), inset 0 0 0 1px rgba(255,255,255,0.1)'
              }}
            />
          )}
        </motion.div>

        {/* Tooltip - opacity fade only, position only changes while invisible */}
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: isTransitioning ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: TOUR_FADE_MS / 1000 }}
          drag
          dragMomentum={false}
          dragElastic={0}
          className={`${isMobile ? 'fixed' : 'absolute'} bg-white rounded-xl shadow-2xl p-5 cursor-move pointer-events-auto ${isMobile ? 'w-[90vw] max-w-[320px]' : 'w-[340px]'}`}
          style={{ 
            ...renderTooltipPos, 
            zIndex: 9999
          }}
          data-testid="tour-tooltip"
        >
          <div className="absolute top-3 right-3 text-slate-300">
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="mb-4 mt-2">
            <div className="text-xs text-blue-600 font-medium mb-1">
              Step {visibleStep + 1} of {totalSteps}
            </div>
            <h3 className="text-lg font-bold text-slate-900">{visibleStepData.title}</h3>
          </div>

          <p className="text-sm text-slate-600 mb-4 leading-relaxed font-normal whitespace-pre-line">
            {(!hasCase && visibleStepData.requiresCase && visibleStepData.noCaseContent) 
              ? visibleStepData.noCaseContent 
              : visibleStepData.content}
          </p>

          {isMobile && visibleStepData.mobileHint && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg mb-4 text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span>{visibleStepData.mobileHint}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-slate-500"
              data-testid="tour-skip-button"
            >
              Skip Tour
            </Button>

            <div className="flex gap-2">
              {visibleStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  data-testid="tour-prev-button"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                data-testid="tour-next-button"
              >
                {visibleStep === totalSteps - 1 ? "Finish" : "Next"}
                {visibleStep < totalSteps - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>

          <div className="flex justify-center gap-1 mt-4 flex-wrap max-w-full">
            {ALL_TOUR_STEPS.map((step, index) => (
              <button
                key={index}
                onClick={() => handleGoToStep(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all hover:scale-125 cursor-pointer ${
                  index === visibleStep 
                    ? "bg-blue-500 ring-2 ring-blue-300" 
                    : index < visibleStep 
                      ? "bg-blue-300 hover:bg-blue-400" 
                      : "bg-slate-300 hover:bg-slate-400"
                }`}
                title={`Step ${index + 1}: ${step.title}`}
                data-testid={`tour-step-dot-${index}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Helper to check if the current tour step requires the mobile drawer to be open
export function shouldOpenMobileDrawer(): boolean {
  const stored = localStorage.getItem(TOUR_STORAGE_KEY);
  if (!stored) return false;
  try {
    const state = JSON.parse(stored);
    if (!state.isActive) return false;
    const step = ALL_TOUR_STEPS[state.globalStepIndex];
    if (!step) return false;
    // Check if step has a mobileTarget (meaning it's inside the mobile drawer)
    return !!step.mobileTarget;
  } catch {
    return false;
  }
}

export function resetAllTours() {
  localStorage.removeItem(TOUR_COMPLETED_KEY);
  clearTourState();
}

export function isTourComplete(): boolean {
  return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
}
