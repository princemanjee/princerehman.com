import { useState } from "react";
import { GlassCard, GlassPanel } from "./components/GlassCard";
import { GlassButton } from "./components/GlassButton";
import { GlassInput } from "./components/GlassInput";
import { GlassCheckbox } from "./components/GlassCheckbox";
import { GlassSelect, GlassSelectItem } from "./components/GlassSelect";
import { GlassSlider } from "./components/GlassSlider";
import { GlassSwitch } from "./components/GlassSwitch";
import { GlassScrollArea } from "./components/GlassScrollArea";
import { GlassNavigation, GlassNavLink } from "./components/GlassNavigation";
import { GlassDropdown, GlassDropdownItem, GlassDropdownSeparator } from "./components/GlassDropdown";
import { GlassComboBox } from "./components/GlassComboBox";
import { GlassRadioGroup } from "./components/GlassRadioGroup";
import { GlassProgress } from "./components/GlassProgress";
import { GlassTabs, GlassTabsList, GlassTabsTrigger, GlassTabsContent } from "./components/GlassTabs";
import { GlassModal, GlassModalFooter } from "./components/GlassModal";
import { GlassTooltip } from "./components/GlassTooltip";
import { GlassBadge } from "./components/GlassBadge";
import { GlassAccordion, GlassAccordionItem } from "./components/GlassAccordion";
import { GlassSpinner, GlassSkeletonCard } from "./components/GlassSpinner";
import { GlassDivider } from "./components/GlassDivider";
import { Settings, User, Bell, ChevronDown, Info } from "lucide-react";

export default function App() {
  const [checked, setChecked] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [selectValue, setSelectValue] = useState("");
  const [sliderValue, setSliderValue] = useState([50]);
  const [comboValue, setComboValue] = useState("");
  const [radioValue, setRadioValue] = useState("option1");
  const [progress, setProgress] = useState(65);
  const [modalOpen, setModalOpen] = useState(false);

  const comboOptions = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "cherry", label: "Cherry" },
    { value: "date", label: "Date" },
    { value: "elderberry", label: "Elderberry" },
  ];

  const radioOptions = [
    { value: "option1", label: "First Option" },
    { value: "option2", label: "Second Option" },
    { value: "option3", label: "Third Option" },
  ];

  return (
    <div className="min-h-screen w-full">
      <GlassNavigation logo="Glass Design System">
        <GlassNavLink href="#" active>Home</GlassNavLink>
        <GlassNavLink href="#">Components</GlassNavLink>
        <GlassNavLink href="#">Documentation</GlassNavLink>
        <GlassNavLink href="#">About</GlassNavLink>
      </GlassNavigation>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-[var(--glass-text)] mb-4">
            Glassmorphic Design System
          </h1>
          <p className="text-xl text-[var(--glass-text-muted)]">
            A polished collection of glass-style UI components
          </p>
        </div>

        <GlassTabs defaultValue="components">
          <GlassTabsList className="mb-8">
            <GlassTabsTrigger value="components">Components</GlassTabsTrigger>
            <GlassTabsTrigger value="forms">Forms</GlassTabsTrigger>
            <GlassTabsTrigger value="navigation">Navigation</GlassTabsTrigger>
          </GlassTabsList>

          <GlassTabsContent value="components">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Buttons</h2>
                <div className="flex flex-wrap gap-4">
                  <GlassButton variant="primary">Primary</GlassButton>
                  <GlassButton variant="secondary">Secondary</GlassButton>
                  <GlassButton variant="ghost">Ghost</GlassButton>
                  <GlassButton variant="destructive">Delete</GlassButton>
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  <GlassButton size="sm">Small</GlassButton>
                  <GlassButton size="md">Medium</GlassButton>
                  <GlassButton size="lg">Large</GlassButton>
                </div>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Cards</h2>
                <div className="space-y-4">
                  <GlassCard variant="default" className="p-4">
                    <h3 className="text-lg mb-2 text-[var(--glass-text)]">Default Card</h3>
                    <p className="text-[var(--glass-text-muted)]">
                      A beautiful glassmorphic card with subtle transparency
                    </p>
                  </GlassCard>
                  <GlassCard variant="hover" className="p-4">
                    <h3 className="text-lg mb-2 text-[var(--glass-text)]">Hover Card</h3>
                    <p className="text-[var(--glass-text-muted)]">
                      Hover over me to see the effect
                    </p>
                  </GlassCard>
                </div>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Progress & Sliders</h2>
                <GlassProgress
                  value={progress}
                  label="Progress"
                  className="mb-6"
                />
                <GlassButton
                  size="sm"
                  onClick={() => setProgress(Math.min(100, progress + 10))}
                  className="mb-6"
                >
                  Increase Progress
                </GlassButton>
                <GlassSlider
                  label="Volume"
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  min={0}
                  max={100}
                />
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Scroll Area</h2>
                <GlassScrollArea height="200px">
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="p-3 backdrop-blur-[8px] bg-[var(--glass-background)] border border-[var(--glass-border)] rounded-lg text-[var(--glass-text)]"
                      >
                        Item {i + 1}
                      </div>
                    ))}
                  </div>
                </GlassScrollArea>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Loading States</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm mb-3 text-[var(--glass-text-muted)]">Spinners</h3>
                    <div className="flex items-center gap-6">
                      <GlassSpinner size="sm" />
                      <GlassSpinner size="md" />
                      <GlassSpinner size="lg" />
                    </div>
                  </div>
                  <GlassDivider />
                  <div>
                    <h3 className="text-sm mb-3 text-[var(--glass-text-muted)]">Skeleton</h3>
                    <GlassSkeletonCard />
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel className="lg:col-span-2">
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Dividers</h2>
                <div className="space-y-6">
                  <GlassDivider />
                  <GlassDivider label="OR" />
                  <div className="flex items-center gap-4 h-20">
                    <div className="text-[var(--glass-text)]">Left</div>
                    <GlassDivider orientation="vertical" className="h-full" />
                    <div className="text-[var(--glass-text)]">Right</div>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </GlassTabsContent>

          <GlassTabsContent value="forms">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Inputs</h2>
                <div className="space-y-4">
                  <GlassInput
                    label="Full Name"
                    placeholder="Enter your name"
                  />
                  <GlassInput
                    label="Email"
                    type="email"
                    placeholder="your@email.com"
                  />
                  <GlassInput
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                  />
                </div>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Select & ComboBox</h2>
                <div className="space-y-4">
                  <GlassSelect
                    label="Choose an option"
                    placeholder="Select..."
                    value={selectValue}
                    onValueChange={setSelectValue}
                  >
                    <GlassSelectItem value="option1">Option 1</GlassSelectItem>
                    <GlassSelectItem value="option2">Option 2</GlassSelectItem>
                    <GlassSelectItem value="option3">Option 3</GlassSelectItem>
                  </GlassSelect>

                  <GlassComboBox
                    label="Search & Select"
                    options={comboOptions}
                    value={comboValue}
                    onValueChange={setComboValue}
                    placeholder="Search fruits..."
                  />
                </div>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Checkboxes & Switches</h2>
                <div className="space-y-4">
                  <GlassCheckbox
                    label="Accept terms and conditions"
                    checked={checked}
                    onCheckedChange={setChecked}
                    id="terms"
                  />
                  <GlassCheckbox
                    label="Subscribe to newsletter"
                    id="newsletter"
                  />
                  <div className="border-t border-[var(--glass-border)] pt-4 mt-4">
                    <GlassSwitch
                      label="Enable notifications"
                      checked={switchChecked}
                      onCheckedChange={setSwitchChecked}
                      id="notifications"
                    />
                    <GlassSwitch
                      label="Dark mode"
                      id="darkmode"
                      className="mt-3"
                    />
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Radio Groups</h2>
                <GlassRadioGroup
                  label="Select your preference"
                  options={radioOptions}
                  value={radioValue}
                  onValueChange={setRadioValue}
                />
              </GlassPanel>
            </div>
          </GlassTabsContent>

          <GlassTabsContent value="navigation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Dropdown Menu</h2>
                <GlassDropdown
                  trigger={
                    <GlassButton variant="secondary">
                      <div className="flex items-center gap-2">
                        Options
                        <ChevronDown size={16} />
                      </div>
                    </GlassButton>
                  }
                >
                  <GlassDropdownItem onSelect={() => console.log("Profile")}>
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      Profile
                    </div>
                  </GlassDropdownItem>
                  <GlassDropdownItem onSelect={() => console.log("Settings")}>
                    <div className="flex items-center gap-2">
                      <Settings size={16} />
                      Settings
                    </div>
                  </GlassDropdownItem>
                  <GlassDropdownSeparator />
                  <GlassDropdownItem onSelect={() => console.log("Notifications")}>
                    <div className="flex items-center gap-2">
                      <Bell size={16} />
                      Notifications
                    </div>
                  </GlassDropdownItem>
                </GlassDropdown>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Modals & Tooltips</h2>
                <div className="space-y-4">
                  <GlassModal
                    trigger={<GlassButton>Open Modal</GlassButton>}
                    title="Example Modal"
                    description="This is a beautiful glassmorphic modal dialog"
                    open={modalOpen}
                    onOpenChange={setModalOpen}
                  >
                    <p className="text-[var(--glass-text-muted)] mb-4">
                      This modal demonstrates the glassmorphic design with backdrop blur
                      and semi-transparent backgrounds. You can add any content here.
                    </p>
                    <GlassInput placeholder="Enter something..." />
                    <GlassModalFooter>
                      <GlassButton variant="ghost" onClick={() => setModalOpen(false)}>
                        Cancel
                      </GlassButton>
                      <GlassButton variant="primary" onClick={() => setModalOpen(false)}>
                        Confirm
                      </GlassButton>
                    </GlassModalFooter>
                  </GlassModal>

                  <div className="flex items-center gap-3">
                    <GlassTooltip content="This is a helpful tooltip!">
                      <GlassButton variant="secondary" size="sm">
                        <Info size={16} />
                      </GlassButton>
                    </GlassTooltip>
                    <span className="text-[var(--glass-text-muted)]">Hover over the icon</span>
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel>
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Badges</h2>
                <div className="flex flex-wrap gap-3">
                  <GlassBadge variant="default">Default</GlassBadge>
                  <GlassBadge variant="success">Success</GlassBadge>
                  <GlassBadge variant="warning">Warning</GlassBadge>
                  <GlassBadge variant="error">Error</GlassBadge>
                  <GlassBadge variant="info">Info</GlassBadge>
                </div>
              </GlassPanel>

              <GlassPanel className="lg:col-span-2">
                <h2 className="text-2xl mb-6 text-[var(--glass-text)]">Accordion</h2>
                <GlassAccordion type="single" defaultValue="item-1">
                  <GlassAccordionItem value="item-1" trigger="What is glassmorphism?">
                    Glassmorphism is a design trend that creates a frosted glass effect using
                    backdrop blur, transparency, and subtle borders. It creates depth and visual
                    hierarchy while maintaining a modern, clean aesthetic.
                  </GlassAccordionItem>
                  <GlassAccordionItem value="item-2" trigger="How does it work?">
                    The effect is achieved using CSS backdrop-filter with blur, combined with
                    semi-transparent backgrounds and subtle borders. This creates the illusion
                    of frosted glass overlaying the content behind it.
                  </GlassAccordionItem>
                  <GlassAccordionItem value="item-3" trigger="Browser support">
                    Backdrop-filter is supported in all modern browsers including Chrome, Firefox,
                    Safari, and Edge. For older browsers, graceful degradation provides a solid
                    background as a fallback.
                  </GlassAccordionItem>
                </GlassAccordion>
              </GlassPanel>
            </div>
          </GlassTabsContent>
        </GlassTabs>

        <GlassPanel className="mt-12">
          <h2 className="text-2xl mb-4 text-[var(--glass-text)]">Design System Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="text-center">
              <div className="text-4xl mb-2">✨</div>
              <h3 className="text-lg mb-2 text-[var(--glass-text)]">Glassmorphism</h3>
              <p className="text-sm text-[var(--glass-text-muted)]">
                Beautiful frosted glass effect with backdrop blur
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🎨</div>
              <h3 className="text-lg mb-2 text-[var(--glass-text)]">Polished</h3>
              <p className="text-sm text-[var(--glass-text-muted)]">
                Carefully crafted with smooth transitions
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">⚡</div>
              <h3 className="text-lg mb-2 text-[var(--glass-text)]">Accessible</h3>
              <p className="text-sm text-[var(--glass-text-muted)]">
                Built with Radix UI primitives for accessibility
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}