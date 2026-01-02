/**
 * Simple personalization engine.
 * Can be upgraded to use LLMs later.
 */

function generateConnectionMessage(lead) {
    // Default templates
    const templates = [
        "Hi {firstName}, I came across your profile and was impressed by your work at {company}. I'm also in the tech space and would love to connect and share insights.",
        "Hello {firstName}, I see we share similar interests in {industry}. I'm looking to expand my network with like-minded professionals. Would be great to connect!",
        "Hi {firstName}, I found your background in {jobTitle} very interesting. I'd love to connect and keep in touch."
    ];

    // Pick a template based on available data
    let template = templates[0];
    if (lead.last_post_topic) {
        template = templates[2].replace('{topic}', lead.last_post_topic);
    } else if (lead.industry) {
        template = templates[1].replace('{industry}', lead.industry);
    }

    return replaceVariables(template, lead);
}

function generateFollowUp(lead, step = 1) {
    if (step === 1) {
        return replaceVariables("Hi {firstName}, thanks for connecting! I'm building a tool for {jobTitle}s. Curious if you have 5 mins to chat?", lead);
    }
    return null;
}

function replaceVariables(template, lead) {
    let msg = template;
    msg = msg.replace(/{firstName}/g, lead.first_name || 'there');
    msg = msg.replace(/{company}/g, lead.company || 'your company');
    msg = msg.replace(/{jobTitle}/g, lead.job_title || 'professional');
    return msg;
}

module.exports = { generateConnectionMessage, generateFollowUp };
