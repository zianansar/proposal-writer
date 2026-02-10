import './SkipLink.css';

interface SkipLinkProps {
  targetId?: string;
  children?: React.ReactNode;
}

/**
 * Skip to main content link for keyboard navigation.
 * Visible only when focused, allows users to bypass navigation.
 * WCAG 2.1 SC 2.4.1 Bypass Blocks (Story 8.2).
 */
export function SkipLink({
  targetId = 'main-content',
  children = 'Skip to main content',
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.tabIndex = -1;
      target.focus();
      // Remove tabindex after focus to prevent future tab stops
      target.addEventListener('blur', () => {
        target.removeAttribute('tabindex');
      }, { once: true });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

export default SkipLink;
