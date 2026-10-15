<template>
  <section class="about">
    <p>
      Bonsai Budget is a minimalist financial tool designed for intentionality. In a world of bloated,
      automated tracking apps, we believe in the power of small-scale cultivation and the "zen" of
      manual awareness.
    </p>

    <h3>The Bonsai Philosophy</h3>
    <p>
      Budgeting is often treated as a restrictive chore, but we view it as an art form. Like a bonsai
      tree, a healthy financial life is not about starvation; it is about intentional pruning.
    </p>
    <p>
      By focusing on your core essentials and carefully trimming away the "overgrowth" of unnecessary
      spending, you create a structure where your savings and long-term goals can thrive. We prioritize
      a mini, high-fidelity experience that gives you total control without the complexity of
      traditional banking software.
    </p>

    <h3>A Secure Foundation</h3>
    <p>
      Just as a tree requires deep, stable roots, your data requires a robust and private foundation.
    </p>
    <ul>
      <li>
        <strong>Bank-Grade Security:</strong> Your data is stored securely in Google Firebase,
        utilizing industry-standard encryption both in transit and at rest.
      </li>
      <li>
        <strong>Private by Default:</strong> Sign-in with Google is required to save your data,
        and strict Firestore security rules ensure no other user can read your data. As the app operator, I have
        administrative access to the database for support and maintenance, but I will never view
        your records without your explicit consent.
      </li>
      <li>
        <strong>Keep It Anonymous:</strong> For your safety, please do not enter personally
        identifiable information in any field — no full account numbers, credit card numbers,
        Social Security numbers, passwords, or other sensitive identifiers. Use short nicknames
        (e.g. "Chase Checking" or "Car Loan") instead.
      </li>
      <li>
        <strong>Reliability Anywhere:</strong> Your budget stays with you. Data is cached locally in
        your browser, allowing for seamless use and updates even when you are offline.
      </li>
    </ul>

    <h3>Intentional Growth</h3>
    <p>
      Whether you are following the 50/30/20 rule or calibrating a custom strategy for a
      high-cost-of-living area, the goal remains the same: to be the pilot of your own economy.
      Bonsai Budget provides the sharp, simple tools you need to prune the waste and nurture your
      future.
    </p>
    <p class="tagline">Cultivate your wealth, one cent at a time.</p>
    <p class="studio-credit">
      <a href="https://www.michaelkitzman.com/" target="_blank" rel="noreferrer">An Unreal City project</a>
    </p>
  </section>
</template>

<style scoped>
.about {
  max-width: 720px;
  line-height: 1.6;
  color: var(--text-primary);
}

.about h3 {
  font-family: 'Manrope', system-ui;
  font-weight: 800;
  font-size: 18px;
  margin-top: 28px;
  margin-bottom: 8px;
  color: var(--green);
}

.about p {
  margin: 0 0 14px;
  color: var(--text-secondary);
}

.about ul {
  margin: 0 0 14px;
  padding-left: 20px;
  color: var(--text-secondary);
}

.about li {
  margin-bottom: 8px;
}

.about strong {
  color: var(--text-primary);
  font-weight: 600;
}

.tagline {
  margin-top: 24px;
  font-style: italic;
  color: var(--green) !important;
  font-weight: 600;
}

.studio-credit {
  margin-top: 32px;
}

.studio-credit a {
  color: var(--text-tertiary);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-style: italic;
  transition: color 0.2s;
}

.studio-credit a:hover {
  color: var(--text-primary);
}
</style>
