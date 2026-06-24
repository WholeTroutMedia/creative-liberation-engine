import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Button,
  Row,
  Column,
  Hr,
  Preview,
  Link,
} from '@react-email/components';

export interface StrategicRecommendation {
  recommendation: string;
  owner: string;
  timeline: string;
  kpi: string;
  dependencies: string[];
  centralizationRisk: number;
  vendorLockInRisk: number;
}

export interface ScorecardDimension {
  dimension: string;
  score: number;
  rationale: string;
}

export interface IdeationEmailProps {
  jobId: string;
  slug: string;
  status: string;
  relevance: number;
  categories: string[];
  sourceTitle: string;
  sourceAuthor: string;
  sourceDate: string;
  sourceMaterialSnippet?: string;
  sourceMaterialUrl?: string;
  
  // STRATEGIC_REPORT schema alignments
  executiveTakeaway: string;
  directive: string;
  recommendations: StrategicRecommendation[];
  stratasPick: {
    decision: string;
    reasoning: string;
  };
  scorecard: ScorecardDimension[];
  
  suggestedAgents: string[];
  constitutionalFlags: string[];
  actionEmail?: string;
}

const defaultProps: IdeationEmailProps = {
  jobId: 'IE-IDX-0177',
  slug: 'flipboard-ideation-consolidation',
  status: 'IDEATED',
  relevance: 95,
  categories: ['strategy', 'sovereignty', 'infrastructure', 'orchestration'],
  sourceTitle: 'Flipboard Ideation Consolidation: Macro-Strategic Alignment',
  sourceAuthor: 'Sovereign Artist',
  sourceDate: '2026-05-14T13:30:00 GMT',
  sourceMaterialSnippet: 'Consolidating 32 disjointed Flipboard ideations into an executable roadmap focusing on sovereign infrastructure and real-time agentic execution.',
  sourceMaterialUrl: 'internal://creative-liberation-engine/reports/flipboard_ideation',
  executiveTakeaway: 'We have consolidated 32 outstanding Flipboard ideations into a macro-strategic roadmap consisting of core epics. Rather than tracking disjointed articles, this consolidation elevates the ideation queue into structured, executable goals aligned with Creative Liberation Engine V6 mandates.',
  directive: 'Elevate the signal-to-noise ratio by migrating away from micro-tracking individual articles. Compress the 32 items into actionable macro-themes focusing on MCP Ecosystem and Edge Infrastructure to regain focus on structural parity.',
  recommendations: [
    {
      recommendation: "MCP Ecosystem & Claude Code Integration",
      owner: "ATHENA",
      timeline: "Q2 2026",
      kpi: "5 core MCP bundles deployed locally",
      dependencies: ["MCP SDK", "V6 Registries"],
      centralizationRisk: 20,
      vendorLockInRisk: 10
    },
    {
      recommendation: "Sovereign Edge Infrastructure & Self-Hosting",
      owner: "STRATA",
      timeline: "Q2 2026",
      kpi: "0 external API calls for core reasoning loops",
      dependencies: ["NAS GPU allocation", "vLLM"],
      centralizationRisk: 90,
      vendorLockInRisk: 0
    },
    {
      recommendation: "The 'Symphony' Orchestration Layer",
      owner: "ATHENA / IRIS",
      timeline: "Q3 2026",
      kpi: "50% reduction in agent failure recovery time",
      dependencies: ["V6 Dispatch Server"],
      centralizationRisk: 80,
      vendorLockInRisk: 10
    }
  ],
  stratasPick: {
    decision: "Execute MCP Ecosystem and Sovereign Edge Infrastructure immediately.",
    reasoning: "The primary bottleneck is the boundary between the isolated context and the external world. Standardizing on MCP while running natively on the NAS unlocks capability expansion while strictly adhering to the 'No-SaaS' sovereignty mandate."
  },
  scorecard: [
    {
      dimension: "Sovereignty Alignment",
      score: 95,
      rationale: "Deep focus on local execution and self-hosting."
    },
    {
      dimension: "Signal-to-Noise",
      score: 100,
      rationale: "Reduces 32 loose items to actionable epics."
    },
    {
      dimension: "Execution Viability",
      score: 85,
      rationale: "Requires significant NAS GPU resource management."
    }
  ],
  suggestedAgents: ['STRATA', 'ATHENA', 'VERA'],
  constitutionalFlags: [
    'Article IX: Ship Complete or Don\'t Ship',
    'NAS Supremacy Rule'
  ],
  actionEmail: 'sentinel@cleengine.systems',
};

export const IdeationEmail = (props: IdeationEmailProps) => {
  const {
    jobId,
    status,
    relevance,
    sourceTitle,
    sourceAuthor,
    sourceDate,
    sourceMaterialSnippet,
    sourceMaterialUrl,
    executiveTakeaway,
    directive,
    recommendations,
    stratasPick,
    scorecard,
    suggestedAgents,
    constitutionalFlags,
    actionEmail = 'sentinel@cleengine.systems',
  } = { ...defaultProps, ...props };

  const activateLink = `mailto:${actionEmail}?subject=ACTIVATE ${jobId}&body=Please ACTIVATE the ideation for ${jobId}.`;
  const parkLink = `mailto:${actionEmail}?subject=PARK ${jobId}&body=Please PARK the ideation for ${jobId}.`;
  const discardLink = `mailto:${actionEmail}?subject=DISCARD ${jobId}&body=Please DISCARD the ideation for ${jobId}.`;

  const getRiskColor = (risk: number) => {
    if (risk > 60) return '#BE123C'; // High risk: Red
    if (risk > 30) return '#F59E0B'; // Medium risk: Yellow
    return '#10B981'; // Low risk: Green
  };

  return (
    <Html>
      <Head />
      <Preview>Briefing: {sourceTitle}</Preview>
      <Body style={main}>
        <Container style={container}>
          
          {/* Header Section */}
          <Section style={magazineHeader}>
            <Row>
              <Column>
                <Text style={brandText}>SENTINEL // BRIEFING REPORT [{jobId}]</Text>
                <Heading style={title}>{sourceTitle}</Heading>
                <Text style={byline}>
                  By <strong>{sourceAuthor}</strong> • {new Date(sourceDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Meta Info Row */}
          <Section style={metaSection}>
            <Row>
              <Column style={metaColumn}>
                <Text style={metaLabel}>STATUS</Text>
                <Text style={metaValueHighlight}>{status}</Text>
              </Column>
              <Column style={metaColumn}>
                <Text style={metaLabel}>RELEVANCE</Text>
                <Text style={metaValue}>{relevance}/100</Text>
              </Column>
              <Column style={metaColumn}>
                <Text style={metaLabel}>SOURCE</Text>
                <Link href={sourceMaterialUrl} style={metaLink}>View Origin</Link>
              </Column>
            </Row>
          </Section>

          {/* Source Material Block */}
          {sourceMaterialSnippet && (
            <Section style={sourceBlock}>
              <Text style={sourceBlockTitle}>Source Material</Text>
              <Text style={sourceBlockText}>"{sourceMaterialSnippet}"</Text>
            </Section>
          )}

          {/* Executive Takeaway */}
          <Section style={{ marginBottom: '32px' }}>
            <Text style={directiveHeader}>Executive Takeaway</Text>
            <Text style={bodyText}>{executiveTakeaway}</Text>
          </Section>

          {/* Directive Section */}
          <Section style={{ marginBottom: '32px' }}>
            <Text style={directiveHeader}>ATHENA's Directive</Text>
            <Text style={directiveText}>{directive}</Text>
          </Section>

          {/* Detailed Recommendations */}
          <Section style={{ marginTop: '50px' }}>
            <Text style={directiveHeader}>Detailed Recommendations</Text>
            {recommendations.map((rec, idx) => (
              <Section key={idx} style={optionCard}>
                <Text style={optionTitle}>{idx + 1}. {rec.recommendation}</Text>
                
                <Row style={{ marginTop: '16px', marginBottom: '8px' }}>
                  <Column style={{ width: '25%', verticalAlign: 'top' }}>
                    <Text style={labelSmall}>OWNER</Text>
                    <Text style={bodyTextSmall}>{rec.owner}</Text>
                  </Column>
                  <Column style={{ width: '25%', verticalAlign: 'top' }}>
                    <Text style={labelSmall}>TIMELINE</Text>
                    <Text style={bodyTextSmall}>{rec.timeline}</Text>
                  </Column>
                  <Column style={{ width: '50%', verticalAlign: 'top' }}>
                    <Text style={labelSmall}>KPI</Text>
                    <Text style={bodyTextSmall}>{rec.kpi}</Text>
                  </Column>
                </Row>
                
                <Row>
                  <Column style={{ width: '50%', verticalAlign: 'top', paddingRight: '10px' }}>
                    <Text style={labelSmall}>DEPENDENCIES</Text>
                    <Text style={bodyTextSmall}>{rec.dependencies.join(', ') || 'None'}</Text>
                  </Column>
                  <Column style={{ width: '25%', verticalAlign: 'top' }}>
                    <Text style={labelSmall}>CENTRALIZATION RISK</Text>
                    <Text style={{ ...bodyTextSmall, color: getRiskColor(rec.centralizationRisk), fontWeight: 'bold' }}>
                      {rec.centralizationRisk}%
                    </Text>
                  </Column>
                  <Column style={{ width: '25%', verticalAlign: 'top' }}>
                    <Text style={labelSmall}>VENDOR LOCK-IN RISK</Text>
                    <Text style={{ ...bodyTextSmall, color: getRiskColor(rec.vendorLockInRisk), fontWeight: 'bold' }}>
                      {rec.vendorLockInRisk}%
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}
          </Section>

          {/* STRATA's Pick */}
          <Section style={{ marginTop: '40px', backgroundColor: '#FAFAFA', padding: '24px', borderLeft: '4px solid #FF3366' }}>
            <Text style={{ ...directiveHeader, borderBottom: 'none', marginBottom: '16px' }}>STRATA's Pick</Text>
            <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#111111', marginBottom: '12px' }}>
              Decision: {stratasPick.decision}
            </Text>
            <Text style={bodyText}>{stratasPick.reasoning}</Text>
          </Section>

          {/* Scorecard */}
          <Section style={{ marginTop: '40px' }}>
            <Text style={directiveHeader}>Scorecard</Text>
            {scorecard.map((score, idx) => (
              <Row key={idx} style={{ marginBottom: '16px' }}>
                <Column style={{ width: '30%', verticalAlign: 'top' }}>
                  <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#111111', margin: '0' }}>{score.dimension}</Text>
                </Column>
                <Column style={{ width: '15%', verticalAlign: 'top' }}>
                  <Text style={{ fontSize: '14px', fontWeight: 'bold', color: getRiskColor(100 - score.score), margin: '0' }}>{score.score}/100</Text>
                </Column>
                <Column style={{ width: '55%', verticalAlign: 'top' }}>
                  <Text style={{ fontSize: '13px', color: '#52525B', margin: '0' }}>{score.rationale}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Metadata Section */}
          <Section style={tagsSection}>
            <Row>
              <Column style={{ verticalAlign: 'top', width: '50%', paddingRight: '10px' }}>
                <Text style={labelSmall}>SUGGESTED AGENTS</Text>
                {suggestedAgents.map(agent => (
                  <Text key={agent} style={tag}>{agent}</Text>
                ))}
              </Column>
              <Column style={{ verticalAlign: 'top', width: '50%', paddingLeft: '10px' }}>
                <Text style={labelSmall}>CONSTITUTIONAL FLAGS</Text>
                {constitutionalFlags.map(flag => (
                  <Text key={flag} style={tagAlert}>{flag}</Text>
                ))}
              </Column>
            </Row>
          </Section>

          {/* Action Buttons */}
          <Section style={actionContainer}>
            <Hr style={dividerThick} />
            <Text style={actionPrompt}>Select an action to proceed:</Text>
            <Row>
              <Column style={{ paddingRight: '10px' }}>
                <Button href={activateLink} style={btnActivate}>
                  ACTIVATE
                </Button>
              </Column>
              <Column style={{ padding: '0 5px' }}>
                <Button href={parkLink} style={btnPark}>
                  PARK
                </Button>
              </Column>
              <Column style={{ paddingLeft: '10px' }}>
                <Button href={discardLink} style={btnDiscard}>
                  DISCARD
                </Button>
              </Column>
            </Row>
          </Section>
          
          <Section style={footer}>
            <Text style={footerText}>CLE ENGINE V6 • SENTINEL IDEATION DISPATCH</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

export default IdeationEmail;

// --- Editorial Styles ---

const main = {
  backgroundColor: '#F4F4F5',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  color: '#111111',
  padding: '40px 0',
};

const container = {
  margin: '0 auto',
  padding: '50px',
  backgroundColor: '#FFFFFF',
  width: '700px',
  maxWidth: '100%',
  border: '1px solid #E4E4E7',
  boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
};

const magazineHeader = {
  borderBottom: '4px solid #111111',
  paddingBottom: '24px',
  marginBottom: '24px',
};

const brandText = {
  fontSize: '11px',
  fontWeight: '800',
  letterSpacing: '2px',
  color: '#FF3366', // Vibrant pop
  textTransform: 'uppercase' as const,
  margin: '0 0 16px 0',
};

const title = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '42px',
  fontWeight: 'normal',
  color: '#111111',
  margin: '0 0 20px 0',
  lineHeight: '1.1',
  letterSpacing: '-0.5px',
};

const byline = {
  fontSize: '14px',
  color: '#52525B',
  margin: '0',
};

const metaSection = {
  marginBottom: '40px',
};

const metaColumn = {
  width: '33.33%',
};

const metaLabel = {
  fontSize: '10px',
  fontWeight: '700',
  color: '#A1A1AA',
  letterSpacing: '1px',
  margin: '0 0 4px 0',
};

const metaValue = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#111111',
  margin: '0',
};

const metaValueHighlight = {
  ...metaValue,
  color: '#FF3366',
  fontWeight: '700',
};

const metaLink = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#3B82F6',
  textDecoration: 'none',
  borderBottom: '1px solid #3B82F6',
};

const sourceBlock = {
  backgroundColor: '#FAFAFA',
  borderLeft: '4px solid #3B82F6', // Blue pop
  padding: '24px',
  margin: '0 0 40px 0',
};

const sourceBlockTitle = {
  fontSize: '10px',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
  color: '#3B82F6',
  letterSpacing: '1px',
  margin: '0 0 12px 0',
};

const sourceBlockText = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '18px',
  lineHeight: '1.6',
  fontStyle: 'italic',
  color: '#3F3F46',
  margin: '0',
};

const directiveHeader = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#111111',
  borderBottom: '1px solid #E4E4E7',
  paddingBottom: '12px',
  marginBottom: '24px',
};

const directiveText = {
  fontSize: '18px',
  lineHeight: '1.6',
  fontWeight: '500',
  color: '#111111',
  margin: '0 0 16px 0',
};

const bodyText = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#52525B',
  margin: '0 0 16px 0',
};

const bodyTextSmall = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#71717A',
  margin: '0 0 16px 0',
};

const optionCard = {
  borderTop: '3px solid #111111',
  paddingTop: '24px',
  marginBottom: '40px',
};

const optionTitle = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#111111',
  margin: '0 0 12px 0',
};

const labelSmall = {
  fontSize: '10px',
  fontWeight: '700',
  color: '#111111',
  margin: '0 0 6px 0',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

const tagsSection = {
  backgroundColor: '#FAFAFA',
  padding: '24px',
  border: '1px solid #F4F4F5',
  marginTop: '20px',
};

const tag = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: '600',
  backgroundColor: '#F4F4F5',
  color: '#52525B',
  padding: '6px 10px',
  margin: '0 8px 8px 0',
  border: '1px solid #E4E4E7',
};

const tagAlert = {
  ...tag,
  backgroundColor: '#FFF1F2',
  color: '#BE123C',
  border: '1px solid #FECDD3',
};

const actionContainer = {
  marginTop: '50px',
  textAlign: 'center' as const,
};

const dividerThick = {
  borderColor: '#111111',
  borderTopWidth: '4px',
  margin: '0 0 30px 0',
};

const actionPrompt = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '18px',
  fontStyle: 'italic',
  color: '#52525B',
  margin: '0 0 24px 0',
};

const btnBase = {
  display: 'block',
  width: '100%',
  textAlign: 'center' as const,
  padding: '16px 0',
  fontWeight: '700',
  fontSize: '13px',
  textDecoration: 'none',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
};

const btnActivate = {
  ...btnBase,
  backgroundColor: '#FF3366', // Vibrant action color
  color: '#FFFFFF',
};

const btnPark = {
  ...btnBase,
  backgroundColor: '#F4F4F5',
  color: '#111111',
  border: '1px solid #E4E4E7',
};

const btnDiscard = {
  ...btnBase,
  backgroundColor: '#111111',
  color: '#FFFFFF',
};

const footer = {
  paddingTop: '40px',
  marginTop: '40px',
  borderTop: '1px solid #E4E4E7',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '2px',
  color: '#A1A1AA',
};
