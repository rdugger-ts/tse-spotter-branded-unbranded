import { useState } from 'react';
// SpotterEmbed is the React wrapper for ThoughtSpot's conversational AI component.
// It renders inside an iframe managed by the Visual Embed SDK.
import { SpotterEmbed } from '@thoughtspot/visual-embed-sdk/react';
// EmbedEvent exposes lifecycle event constants (Init, Load, Error, etc.)
import { EmbedEvent } from '@thoughtspot/visual-embed-sdk';
// CustomisationsInterface types the object that controls branding — icon sprites,
// string overrides, and string ID overrides for specific UI copy slots.
import type { CustomisationsInterface } from '@thoughtspot/visual-embed-sdk';

// The Model (Worksheet) GUID that Spotter will query against.
// Set VITE_TS_WORKSHEET_ID in your .env file.
const WORKSHEET_ID = import.meta.env.VITE_TS_WORKSHEET_ID;

// ---------------------------------------------------------------------------
// BRANDED_CUSTOMIZATIONS — applied only in "Branded Spotter" mode.
//
// CustomisationsInterface has three top-level sections:
//   style     → CSS variable overrides and custom stylesheet URLs
//   iconSpriteUrl → URL to an SVG sprite that replaces the default TS icon set
//   content   → string and stringID overrides for UI copy
// ---------------------------------------------------------------------------
const BRANDED_CUSTOMIZATIONS: CustomisationsInterface = {
  // Replace the default ThoughtSpot icon set with a custom SVG sprite.
  // The sprite must follow the same <symbol id="..."> conventions as the TS sprite.
  iconSpriteUrl: 'https://cdn.jsdelivr.net/gh/datasketch45/public_assets/custom_icons.svg',

  content: {
    // strings: simple key→value replacements applied globally across the embed.
    // Any occurrence of the key string in the UI is swapped for the value.
    strings: {
      'Spotter': 'Wells',                                         // Rename the AI persona
      'ThoughtSpot': 'WF Analytics',                             // Replace product name throughout
      'Let\'s make sense of your data together': 'Ask me anything about your data', // Reword the subtitle
    },

    // stringIDs: targeted overrides using ThoughtSpot's internal i18n keys.
    // These hit specific copy slots and take precedence over generic string replacements,
    // which is useful for landing-page hero text that must match exactly.
    stringIDs: {
      // The main greeting shown on Spotter's empty/landing state
      'spotter.newChatPrompt.landingPage.title': 'Hi, I’m Agent WF, your data analyst!',
    },
  },
};

// ---------------------------------------------------------------------------
// BRANDED_CHAT_CONFIG — controls Spotter's chat card branding (spotterChatConfig).
//
// SpotterChatViewConfig properties:
//   hideToolResponseCardBranding  → hides the TS logo/icon inside AI response cards
//   toolResponseCardBrandingLabel → replaces the "ThoughtSpot" label in response cards
//   spotterFileUploadEnabled      → allows users to upload files in the chat input
// ---------------------------------------------------------------------------
const BRANDED_CHAT_CONFIG = {
  // Suppress the ThoughtSpot logo from appearing inside tool-response cards
  hideToolResponseCardBranding: true,
  // Label shown in the header of each AI-generated response card
  toolResponseCardBrandingLabel: 'WF Agent',
  // Enable the file-upload button in the Spotter chat input area
  spotterFileUploadEnabled: true,
};

// ---------------------------------------------------------------------------
// SpotterPage — renders a toggle bar above the SpotterEmbed iframe.
//
// State:
//   branded (false) → vanilla Spotter with no customizations
//   branded (true)  → fully branded embed (BRANDED_CUSTOMIZATIONS + BRANDED_CHAT_CONFIG)
//
// The button label always shows where clicking will take you next:
//   showing Basic  → button says "Branded Spotter"
//   showing Branded → button says "Basic Spotter"
// ---------------------------------------------------------------------------
export default function SpotterPage() {
  const [branded, setBranded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toggle bar — shows current mode label and a button to switch */}
      <div style={styles.bar}>
        <span style={styles.label}>{branded ? 'Branded Spotter' : 'Basic Spotter'}</span>
        <button style={styles.button} onClick={() => setBranded((b) => !b)}>
          {branded ? 'Basic Spotter' : 'Branded Spotter'}
        </button>
      </div>

      {/*
        SpotterEmbed props:
          worksheetId            → the Model/Worksheet GUID Spotter runs queries against
          frameParams            → sets the iframe dimensions
          updatedSpotterChatPrompt → opts in to the updated chat input UI (SDK 1.39+)
          customizations         → branding overrides (icons, strings); undefined in basic mode
          spotterChatConfig      → chat card branding config; undefined in basic mode
          onInit / onLoad / onError → lifecycle event callbacks logged to the console
      */}
      <SpotterEmbed
        worksheetId={WORKSHEET_ID}
        frameParams={{ height: '720px' }}
        updatedSpotterChatPrompt={true}
        customizations={branded ? BRANDED_CUSTOMIZATIONS : undefined}
        spotterChatConfig={branded ? BRANDED_CHAT_CONFIG : undefined}
        onInit={() => console.log(EmbedEvent.Init)}
        onLoad={() => console.log(EmbedEvent.Load)}
        onError={(e: unknown) => console.error('SpotterEmbed error:', e)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — kept as a typed record so React accepts them without cast.
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: '#f8f8f8',
    borderBottom: '1px solid #e2e2e2',
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
    color: '#333',
  },
  button: {
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    border: '1px solid #1e6bf7',
    background: '#1e6bf7',
    color: '#fff',
  },
};
