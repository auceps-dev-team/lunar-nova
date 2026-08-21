/**
 * Agents « système » d'AiChat — extraits de src/pages/AiChat.jsx (refactor de
 * découpage — aucun changement de comportement). Le tableau dépend de t() :
 * il est produit par une fonction appelée dans un useMemo du composant parent.
 */
export function makeSystemAgents(t) {
    return [
        { id: 'copywriter', name: t('agentJarvisName'), description: t('agentJarvisDesc'), isSystem: true },
        { id: 'legal', name: t('agentLegalName'), description: t('agentLegalDesc'), isSystem: true },
        { id: 'ella', name: t('agentEllaName'), description: t('agentEllaDesc'), isSystem: true },
        { id: 'brand_guardian', name: t('agentBrandName'), description: t('agentBrandDesc'), isSystem: true },
        { id: 'paid_social_strategist', name: t('agentPaidSocialName'), description: t('agentPaidSocialDesc'), isSystem: true },
        { id: 'ad_creative_strategist', name: t('agentCreativeAdsName'), description: t('agentCreativeAdsDesc'), isSystem: true },
        { id: 'outbound_strategist', name: t('agentOutboundName'), description: t('agentOutboundDesc'), isSystem: true },
        { id: 'sales_engineer', name: t('agentSalesEngName'), description: t('agentSalesEngDesc'), isSystem: true },
        { id: 'sales_coach', name: t('agentSalesCoachName'), description: t('agentSalesCoachDesc'), isSystem: true },
        { id: 'growth_hacker', name: t('agentGrowthName'), description: t('agentGrowthDesc'), isSystem: true },
        { id: 'content_creator', name: t('agentContentName'), description: t('agentContentDesc'), isSystem: true },
        { id: 'twitter_engager', name: t('agentTwitterName'), description: t('agentTwitterDesc'), isSystem: true },
        { id: 'tiktok_strategist', name: t('agentTiktokName'), description: t('agentTiktokDesc'), isSystem: true },
        { id: 'instagram_curator', name: t('agentInstaName'), description: t('agentInstaDesc'), isSystem: true },
        { id: 'social_media_strategist', name: t('agentSocialMediaName'), description: t('agentSocialMediaDesc'), isSystem: true },
        { id: 'seo_specialist', name: t('agentSeoName'), description: t('agentSeoDesc'), isSystem: true },
        { id: 'podcast_strategist', name: t('agentPodcastName'), description: t('agentPodcastDesc'), isSystem: true },
        { id: 'support_responder', name: t('agentSupportName'), description: t('agentSupportDesc'), isSystem: true },
        { id: 'legal_compliance', name: t('agentComplianceName'), description: t('agentComplianceDesc'), isSystem: true },
        { id: 'account_strategist', name: t('agentAccountName'), description: t('agentAccountDesc'), isSystem: true },
    ];
}
